export class HttpException extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.constructor.name,
      statusCode: this.statusCode,
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
