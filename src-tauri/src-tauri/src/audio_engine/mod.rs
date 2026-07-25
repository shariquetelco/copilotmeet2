pub mod loopback;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

pub struct AudioFrame {
    pub data: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
}

pub struct CaptureHandle {
    pub receiver: Receiver<AudioFrame>,
    pub device_changed: Receiver<()>,
    stop_flag: Arc<AtomicBool>,
}

impl CaptureHandle {
    pub(crate) fn new(
        receiver: Receiver<AudioFrame>,
        device_changed: Receiver<()>,
        stop_flag: Arc<AtomicBool>,
    ) -> Self {
        Self { receiver, device_changed, stop_flag }
    }

    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }

    pub fn stopper(&self) -> impl Fn() + Send + Sync + 'static {
        let flag = self.stop_flag.clone();
        move || flag.store(true, Ordering::SeqCst)
    }
}

pub fn start_capture() -> Result<CaptureHandle, String> {
    loopback::start_wasapi_loopback()
}