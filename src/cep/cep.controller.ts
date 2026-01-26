import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { CepService } from './cep.service';
import { CepStreamEvent } from './cep.types';
import { Multer } from 'multer';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Post('upload/:processId')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Multer.File,
    @Param('processId') processId: string,
  ) {
    void this.cepService.startProcess(file, processId);

    return {
      processId,
      status: 'PROCESS_STARTED',
    };
  }

  @Get('stream/:processId')
  stream(
    @Param('processId') processId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (event: CepStreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    this.cepService.registerStream(processId, send);

    req.on('close', () => {
      this.cepService.unregisterStream(processId);
      res.end();
    });
  }
}
