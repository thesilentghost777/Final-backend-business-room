import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = HttpStatus.BAD_REQUEST;
    let message: string = exception.message;
    switch (exception.code) {
      case 'P2002': status = HttpStatus.CONFLICT; message = `Duplicate value on ${(exception.meta as any)?.target}`; break;
      case 'P2025': status = HttpStatus.NOT_FOUND; message = 'Resource not found'; break;
    }
    res.status(status).json({ success: false, statusCode: status, error: { code: exception.code, message } });
  }
}
