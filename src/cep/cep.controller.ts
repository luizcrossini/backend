/* eslint-disable */
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
import { CepService } from '../cep/cep.service';
import { CepStreamEvent } from '../cep/cep.types';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  /**
   * Inicia o processamento da planilha
   */
  @Post('upload/:processId')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Param('processId') processId: string,
  ) {
    // roda em background
    void this.cepService.startProcess(file, processId);

    return {
      processId,
      status: 'PROCESS_STARTED',
    };
  }

  /**
   * Stream SSE para progresso em tempo real
   */
  @Get('stream/:processId')
  stream(
    @Param('processId') processId: string,
    @Res() res: Response,
    @Req() req: Request, // ✅ AQUI ESTÁ A CORREÇÃO
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
