"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastActionConfig = {
  label: string;
  onClick?: () => void;
  altText?: string;
};

type ToastConfig = {
  id?: string;
  title: string;
  description?: string;
  actions?: ToastActionConfig[];
  duration?: number;
};

type ToastState = ToastConfig & { id: string };

type ToastStore = {
  toasts: ToastState[];
};

type ToastListener = (state: ToastStore) => void;

const DEFAULT_DURATION = 6000;
let memoryState: ToastStore = { toasts: [] };
const listeners = new Set<ToastListener>();

function emit(state: ToastStore) {
  memoryState = state;
  listeners.forEach((listener) => listener(memoryState));
}

function dismissToast(id: string) {
  emit({
    toasts: memoryState.toasts.filter((toastItem) => toastItem.id !== id),
  });
}

function pushToast(config: ToastConfig) {
  const id = config.id ?? crypto.randomUUID();
  emit({
    toasts: [
      ...memoryState.toasts,
      {
        ...config,
        id,
        duration: config.duration ?? DEFAULT_DURATION,
      },
    ],
  });
  return id;
}

export function toast(config: ToastConfig) {
  return pushToast(config);
}

export function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast: pushToast,
    dismiss: dismissToast,
  };
}

const ToastProviderPrimitive = ToastPrimitive.Provider;

function ToastProvider({
  children,
  duration = DEFAULT_DURATION,
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastProviderPrimitive duration={duration}>{children}</ToastProviderPrimitive>;
}

function Toast({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>) {
  return (
  <ToastPrimitive.Root
    className={cn(
      "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-lg border border-warmgray-200 bg-white p-4 shadow-lg",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0",
      "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
      className,
    )}
    {...props}
  />
  );
}

function ToastTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>) {
  return (
  <ToastPrimitive.Title
    className={cn("text-sm font-semibold text-warmgray-900", className)}
    {...props}
  />
  );
}

function ToastDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>) {
  return (
  <ToastPrimitive.Description
    className={cn("text-sm text-warmgray-600", className)}
    {...props}
  />
  );
}

function ToastAction({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>) {
  return (
  <ToastPrimitive.Action
    className={cn(
      "inline-flex h-8 items-center rounded-md border border-warmgray-300 px-3 text-xs font-medium text-warmgray-700 transition-colors hover:bg-warmgray-50",
      className,
    )}
    {...props}
  />
  );
}

function ToastViewport({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>) {
  const { toasts, dismiss } = useToast();

  return (
    <>
      {toasts.map((toastItem) => (
        <Toast
          key={toastItem.id}
          open
          duration={toastItem.duration}
          onOpenChange={(open) => {
            if (!open) dismiss(toastItem.id);
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{toastItem.title}</ToastTitle>
            {toastItem.description ? (
              <ToastDescription>{toastItem.description}</ToastDescription>
            ) : null}
            {toastItem.actions && toastItem.actions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {toastItem.actions.map((action, index) => (
                  <ToastAction
                    key={`${toastItem.id}-action-${index}`}
                    altText={action.altText ?? action.label}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </ToastAction>
                ))}
              </div>
            ) : null}
          </div>
          <ToastPrimitive.Close
            className="rounded-md p-1 text-warmgray-500 transition-colors hover:bg-warmgray-100 hover:text-warmgray-700"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </Toast>
      ))}
      <ToastPrimitive.Viewport
        className={cn(
          "fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]",
          className,
        )}
        {...props}
      />
    </>
  );
}

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastAction };
