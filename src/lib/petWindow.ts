import { settingsService } from "@/lib/settingsService";

export async function findMyPet() {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const { currentMonitor } = await import("@tauri-apps/api/window");
  const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");

  const pet = await WebviewWindow.getByLabel("pet");
  if (!pet) return;

  const monitor = await currentMonitor();
  if (!monitor) return;

  const dotSize = 88; // large, always, regardless of saved preference
  const targetW = dotSize + 16;
  const targetH = dotSize + 16;

  await pet.setSize(new LogicalSize(targetW, targetH));

  const scale = monitor.scaleFactor;
  const monitorX = monitor.position.x / scale;
  const monitorY = monitor.position.y / scale;
  const monitorW = monitor.size.width / scale;
  const monitorH = monitor.size.height / scale;

  const centerX = monitorX + (monitorW - targetW) / 2;
  const centerY = monitorY + (monitorH - targetH) / 2;

  await pet.setPosition(new LogicalPosition(centerX, centerY));
  await pet.show();
  await pet.setFocus();
}

export async function resetPetWindowPosition() {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const { currentMonitor } = await import("@tauri-apps/api/window");
  const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");

  const pet = await WebviewWindow.getByLabel("pet");
  if (!pet) return;

  const monitor = await currentMonitor();
  if (!monitor) return;

  const dockPosition = (await settingsService.get("pet.position")) || "bottom-right";
  const petSize = (await settingsService.get("pet.size")) || "medium";
  const sizeMap: Record<string, number> = { small: 48, medium: 64, large: 88 };
  const dotSize = sizeMap[petSize] ?? 64;
  const targetW = dotSize + 16;
  const targetH = dotSize + 16;

  await pet.setSize(new LogicalSize(targetW, targetH));

  const margin = 24;
  const scale = monitor.scaleFactor;
  const monitorX = monitor.position.x / scale;
  const monitorY = monitor.position.y / scale;
  const monitorW = monitor.size.width / scale;
  const monitorH = monitor.size.height / scale;

  const corners: Record<string, { x: number; y: number }> = {
    "top-left": { x: monitorX + margin, y: monitorY + margin },
    "top-right": { x: monitorX + monitorW - targetW - margin, y: monitorY + margin },
    "bottom-left": { x: monitorX + margin, y: monitorY + monitorH - targetH - margin },
    "bottom-right": { x: monitorX + monitorW - targetW - margin, y: monitorY + monitorH - targetH - margin },
  };
  const target = corners[dockPosition] ?? corners["bottom-right"];
  await pet.setPosition(new LogicalPosition(target.x, target.y));
  await pet.show();
  await pet.setFocus();
}