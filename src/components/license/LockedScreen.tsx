export default function LockedScreen({ reason }: { reason: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm text-center flex flex-col gap-3">
        <h1 className="text-lg font-bold">CopilotMeet is Locked</h1>
        <p className="text-sm text-gray-500">{reason}</p>
      </div>
    </div>
  );
}