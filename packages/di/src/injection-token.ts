export class InjectionToken<T = any> {
  readonly __brand!: T;
  readonly description;
  constructor(description: string) {
    this.description = description;
  }
}
