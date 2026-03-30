export interface OnInit {
  onInit(): void | Promise<void>;
}

export interface OnDestroy {
  onDestroy(): void | Promise<void>;
}

export function hasOnInit(obj: unknown): obj is OnInit {
  return typeof (obj as any)?.onInit === "function";
}

export function hasOnDestroy(obj: unknown): obj is OnDestroy {
  return typeof (obj as any)?.onDestroy === "function";
}
