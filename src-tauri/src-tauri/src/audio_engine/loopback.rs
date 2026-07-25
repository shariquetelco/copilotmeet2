use std::collections::VecDeque;
use std::time::{Duration, Instant};
use wasapi::{initialize_mta, DeviceEnumerator, Direction, StreamMode};

pub fn test_capture(seconds: u64) -> Result<usize, String> {
    initialize_mta().ok().map_err(|e| e.to_string())?;

    let enumerator = DeviceEnumerator::new().map_err(|e| e.to_string())?;
    let device = enumerator
        .get_default_device(&Direction::Render)
        .map_err(|e| e.to_string())?;
    let mut audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;

    let desired_format = audio_client.get_mixformat().map_err(|e| e.to_string())?;
    let blockalign = desired_format.get_blockalign();

    let (_, min_time) = audio_client.get_device_period().map_err(|e| e.to_string())?;
    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: min_time,
    };
    audio_client
        .initialize_client(&desired_format, &Direction::Capture, &mode)
        .map_err(|e| e.to_string())?;

    let h_event = audio_client.set_get_eventhandle().map_err(|e| e.to_string())?;
    let buffer_frame_count = audio_client.get_buffer_size().map_err(|e| e.to_string())?;
    let capture_client = audio_client.get_audiocaptureclient().map_err(|e| e.to_string())?;

    let mut sample_queue: VecDeque<u8> = VecDeque::with_capacity(
        100 * blockalign as usize * (1024 + 2 * buffer_frame_count as usize),
    );

    audio_client.start_stream().map_err(|e| e.to_string())?;

    let mut total_bytes: usize = 0;
    let start = Instant::now();
    let limit = Duration::from_secs(seconds);

    while start.elapsed() < limit {
        capture_client
            .read_from_device_to_deque(&mut sample_queue)
            .map_err(|e| e.to_string())?;
        total_bytes += sample_queue.len();
        sample_queue.clear();

        if h_event.wait_for_event(3000).is_err() {
            break;
        }
    }

    audio_client.stop_stream().map_err(|e| e.to_string())?;

    Ok(total_bytes)
}