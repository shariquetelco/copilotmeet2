use super::{AudioFrame, CaptureHandle};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use wasapi::{initialize_mta, DeviceEnumerator, Direction, StreamMode};

pub fn start_wasapi_loopback() -> Result<CaptureHandle, String> {
    let (tx, rx) = mpsc::channel();
    let (dc_tx, dc_rx) = mpsc::channel();
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_thread = stop_flag.clone();

    thread::Builder::new()
        .name("AudioCapture".to_string())
        .spawn(move || {
            if let Err(e) = capture_loop(tx, dc_tx, stop_flag_thread) {
                eprintln!("Audio capture error: {}", e);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(CaptureHandle::new(rx, dc_rx, stop_flag))
}

fn capture_loop(
    tx: Sender<AudioFrame>,
    device_changed_tx: Sender<()>,
    stop_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    initialize_mta().ok().map_err(|e| e.to_string())?;

    let enumerator = DeviceEnumerator::new().map_err(|e| e.to_string())?;
    let device = enumerator
        .get_default_device(&Direction::Render)
        .map_err(|e| e.to_string())?;
    let original_device_id = device.get_id().map_err(|e| e.to_string())?;

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

    let mut last_device_check = Instant::now();
    let device_check_interval = Duration::from_secs(3);

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

        if last_device_check.elapsed() >= device_check_interval {
            last_device_check = Instant::now();
            let current_default_id = DeviceEnumerator::new()
                .ok()
                .and_then(|e| e.get_default_device(&Direction::Render).ok())
                .and_then(|d| d.get_id().ok());

            if let Some(current_id) = current_default_id {
                if current_id != original_device_id {
                    println!("Default audio output device changed, ending this capture.");
                    let _ = device_changed_tx.send(());
                    break;
                }
            }
        }

        if h_event.wait_for_event(3000).is_err() {
            println!("Audio event wait failed (device likely disconnected).");
            let _ = device_changed_tx.send(());
            break;
        }
    }

    let _ = audio_client.stop_stream();
    Ok(())
}

pub fn test_capture(seconds: u64) -> Result<usize, String> {
    let handle = start_wasapi_loopback()?;
    let deadline = Instant::now() + Duration::from_secs(seconds);

    let mut total_bytes = 0usize;
    while Instant::now() < deadline {
        match handle.receiver.recv_timeout(Duration::from_millis(500)) {
            Ok(frame) => total_bytes += frame.data.len(),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    handle.stop();
    Ok(total_bytes)
}