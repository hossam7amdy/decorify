import { hasOnInit, hasOnDestroy } from "./interfaces.js";

export class LifecycleManager {
  private instances: unknown[] = [];

  track(instance: unknown): void {
    this.instances.push(instance);
  }

  async callOnInit(): Promise<void> {
    for (const instance of this.instances) {
      if (hasOnInit(instance)) {
        await instance.onInit();
      }
    }
  }

  async callOnDestroy(): Promise<void> {
    for (const instance of [...this.instances].reverse()) {
      if (hasOnDestroy(instance)) {
        await instance.onDestroy();
      }
    }
  }
}
