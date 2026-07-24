pub mod loopback;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

/// A chunk of raw PCM audio, plus the format needed to interpret it.
/// This is the only thing downstream consumers (Deepgram, etc.) ever see —
/// they never know whether it came from WASAPI, a microphone, or a file.
pub struct AudioFrame {
    pub data: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
}

pub struct CaptureHandle {
    pub receiver: Receiver<AudioFrame>,
    stop_flag: Arc<AtomicBool>,
}

impl CaptureHandle {
    pub(crate) fn new(receiver: Receiver<AudioFrame>, stop_flag: Arc<AtomicBool>) -> Self {
        Self { receiver, stop_flag }
    }

    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }

    /// Returns a standalone stop function that outlives `self` — needed
    /// when the receiver gets moved out (to the Deepgram client) but the
    /// caller still needs to stop capture later.
    pub fn stopper(&self) -> impl Fn() + Send + Sync + 'static {
        let flag = self.stop_flag.clone();
        move || flag.store(true, Ordering::SeqCst)
    }
}

/// Starts capturing "what's playing on this PC" audio.
/// Today this is WASAPI loopback (Windows only). Swapping in Core Audio,
/// a microphone, or a recorded file later means adding a new function
/// here — Deepgram and everything downstream never changes.
pub fn start_capture() -> Result<CaptureHandle, String> {
    loopback::start_wasapi_loopback()
}