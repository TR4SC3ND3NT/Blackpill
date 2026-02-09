export type LoadingOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
};

export function LoadingOverlay({
  open,
  title = "Loading...",
  subtitle = "Please wait",
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-[9999]">
      <div className="text-center">
        <div
          className="w-12 h-12 border-[3px] border-gray-900/20 border-t-gray-900 rounded-full animate-spin mx-auto mb-3"
          role="status"
          aria-label="Loading"
        />
        <div className="text-sm font-medium text-gray-900 mb-1">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}

