use crate::audio_engine::CaptureHandle;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver};
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::AUTHORIZATION;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub struct TranscriptEvent {
    pub text: String,
    pub is_final: bool,
}

#[derive(Deserialize)]
struct DeepgramResponse {
    is_final: Option<bool>,
    channel: Option<DeepgramChannel>,
}

#[derive(Deserialize)]
struct DeepgramChannel {
    alternatives: Vec<DeepgramAlternative>,
}

#[derive(Deserialize)]
struct DeepgramAlternative {
    transcript: String,
}

/// WASAPI hands us 32-bit float samples. Deepgram's linear16 encoding
/// wants 16-bit signed integers. This converts one to the other.
fn f32_bytes_to_i16_bytes(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() / 2);
    for chunk in data.chunks_exact(4) {
        let sample = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        let clamped = sample.clamp(-1.0, 1.0);
        let as_i16 = (clamped * i16::MAX as f32) as i16;
        out.extend_from_slice(&as_i16.to_le_bytes());
    }
    out
}

pub async fn start_transcription(
    capture: CaptureHandle,
    api_key: String,
    keyterms: Vec<String>,
) -> Result<(UnboundedReceiver<TranscriptEvent>, Vec<tokio::task::JoinHandle<()>>), String> {
    let mut tasks = Vec::new();
    let (format_tx, format_rx) = oneshot::channel::<(u32, u16)>();
    let (audio_tx, mut audio_rx) = unbounded_channel::<Vec<u8>>();

    let capture_receiver = capture.receiver;
    std::thread::spawn(move || {
        let mut format_tx = Some(format_tx);
        while let Ok(frame) = capture_receiver.recv() {
            if let Some(tx) = format_tx.take() {
                let _ = tx.send((frame.sample_rate, frame.channels));
            }
            let pcm16 = f32_bytes_to_i16_bytes(&frame.data);
            if audio_tx.send(pcm16).is_err() {
                break;
            }
        }
    });

    let (sample_rate, channels) = format_rx
        .await
        .map_err(|_| "Audio capture stopped before any frames arrived".to_string())?;

    let mut url = format!(
        "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate={}&channels={}&punctuate=true&interim_results=true",
        sample_rate, channels
    );

    for term in &keyterms {
        url.push_str(&format!("&keywords={}:2", term));
    }
    println!("Deepgram keyword boost list: {:?}", keyterms);

    let mut request = url.into_client_request().map_err(|e| e.to_string())?;
    request.headers_mut().insert(
        AUTHORIZATION,
        format!("Token {}", api_key)
            .parse()
            .map_err(|e: tokio_tungstenite::tungstenite::http::header::InvalidHeaderValue| e.to_string())?,
    );

    println!("Connecting to Deepgram...");

    let (ws_stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio_tungstenite::connect_async(request),
    )
    .await
    .map_err(|_| "Deepgram connection timed out after 10s".to_string())?
    .map_err(|e| format!("Deepgram connection failed: {}", e))?;

    println!("Deepgram connected.");

    let (mut ws_write, mut ws_read) = ws_stream.split();

    tasks.push(tokio::spawn(async move {
        while let Some(bytes) = audio_rx.recv().await {
            if ws_write.send(Message::Binary(bytes)).await.is_err() {
                println!("Deepgram audio send failed, stopping.");
                break;
            }
        }
    }));

    let (transcript_tx, transcript_rx) = unbounded_channel::<TranscriptEvent>();
    tasks.push(tokio::spawn(async move {
        while let Some(msg) = ws_read.next().await {
            let msg = match msg {
                Ok(m) => m,
                Err(e) => {
                    println!("Deepgram websocket error: {}", e);
                    break;
                }
            };

            match msg {
                Message::Text(text) => {
                    println!("Deepgram raw: {}", text);
                    if let Ok(parsed) = serde_json::from_str::<DeepgramResponse>(&text) {
                        if let Some(channel) = parsed.channel {
                            if let Some(alt) = channel.alternatives.get(0) {
                                if !alt.transcript.trim().is_empty() {
                                    let event = TranscriptEvent {
                                        text: alt.transcript.clone(),
                                        is_final: parsed.is_final.unwrap_or(false),
                                    };
                                    if transcript_tx.send(event).is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                Message::Close(frame) => {
                    println!("Deepgram closed connection: {:?}", frame);
                    break;
                }
                _ => {}
            }
        }
    }));

    Ok((transcript_rx, tasks))
}