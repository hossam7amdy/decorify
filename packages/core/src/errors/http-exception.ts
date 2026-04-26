import type { HttpStatus } from "./status-code.ts";

export class HttpException extends Error {
  readonly status: HttpStatus;
  readonly details?: unknown;

  constructor(status: HttpStatus, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.constructor.name,
      status: this.status,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class BadRequestException extends HttpException {
  constructor(message = "Bad Request", details?: unknown) {
    super(400, message, details);
    this.name = "BadRequestException";
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized", details?: unknown) {
    super(401, message, details);
    this.name = "UnauthorizedException";
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden", details?: unknown) {
    super(403, message, details);
    this.name = "ForbiddenException";
  }
}

export class NotFoundException extends HttpException {
  constructor(message = "Not Found", details?: unknown) {
    super(404, message, details);
    this.name = "NotFoundException";
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = "Internal Server Error", details?: unknown) {
    super(500, message, details);
    this.name = "InternalServerErrorException";
  }
}

export class MethodNotAllowedException extends HttpException {
  constructor(message = "Method Not Allowed", details?: unknown) {
    super(405, message, details);
    this.name = "MethodNotAllowedException";
  }
}

export class ConflictException extends HttpException {
  constructor(message = "Conflict", details?: unknown) {
    super(409, message, details);
    this.name = "ConflictException";
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor(message = "Unprocessable Entity", details?: unknown) {
    super(422, message, details);
    this.name = "UnprocessableEntityException";
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(message = "Too Many Requests", details?: unknown) {
    super(429, message, details);
    this.name = "TooManyRequestsException";
  }
}
