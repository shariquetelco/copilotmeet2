use super::{AudioFrame, CaptureHandle};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use wasapi::{initialize_mta, DeviceEnumerator, Direction, StreamMode};

/// Starts a background thread capturing WASAPI loopback audio (system
/// output — "the other side" of a call, not the microphone) and streams
/// it out as AudioFrame chunks until CaptureHandle::stop() is called.
pub fn start_wasapi_loopback() -> Result<CaptureHandle, String> {
    let (tx, rx) = mpsc::channel();
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_thread = stop_flag.clone();

    thread::Builder::new()
        .name("AudioCapture".to_string())
        .spawn(move || {
            if let Err(e) = capture_loop(tx, stop_flag_thread) {
                eprintln!("Audio capture error: {}", e);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(CaptureHandle::new(rx, stop_flag))
}

fn capture_loop(tx: Sender<AudioFrame>, stop_flag: Arc<AtomicBool>) -> Result<(), String> {
    initialize_mta().ok().map_err(|e| e.to_string())?;

    let enumerator = DeviceEnumerator::new().map_err(|e| e.to_string())?;
    let device = enumerator
        .get_default_device(&Direction::Render)
        .map_err(|e| e.to_string())?;
    let mut audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;

    let desired_format = audio_client.get_mixformat().map_err(|e| e.to_string())?;
    let sample_rate = desired_format.get_samplespersec();
    let channels = desired_format.get_nchannels();
    let bits_per_sample = desired_format.get_bitspersample();

    let (_, min_time) = audio_client.get_device_period().map_err(|e| e.to_string())?;
    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: min_time,
    };
    audio_client
        .initialize_client(&desired_format, &Direction::Capture, &mode)
        .map_err(|e| e.to_string())?;

    let h_event = audio_client.set_get_eventhandle().map_err(|e| e.to_string())?;
    let capture_client = audio_client.get_audiocaptureclient().map_err(|e| e.to_string())?;

    let mut sample_queue: VecDeque<u8> = VecDeque::with_capacity(1024 * 1024);

    audio_client.start_stream().map_err(|e| e.to_string())?;

    while !stop_flag.load(Ordering::SeqCst) {
        capture_client
            .read_from_device_to_deque(&mut sample_queue)
            .map_err(|e| e.to_string())?;

        if !sample_queue.is_empty() {
            let chunk: Vec<u8> = sample_queue.drain(..).collect();
            let frame = AudioFrame {
                data: chunk,
                sample_rate,
                channels,
                bits_per_sample,
            };
            if tx.send(frame).is_err() {
                break;
            }
        }

        if h_event.wait_for_event(3000).is_err() {
            break;
        }
    }

    let _ = audio_client.stop_stream();
    Ok(())
}

/// Quick manual test: captures for N seconds and returns total bytes,
/// proving the Audio Engine abstraction works end to end.
pub fn test_capture(seconds: u64) -> Result<usize, String> {
    let handle = start_wasapi_loopback()?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(seconds);

    let mut total_bytes = 0usize;
    while std::time::Instant::now() < deadline {
        match handle.receiver.recv_timeout(std::time::Duration::from_millis(500)) {
            Ok(frame) => total_bytes += frame.data.len(),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    handle.stop();
    Ok(total_bytes)
}