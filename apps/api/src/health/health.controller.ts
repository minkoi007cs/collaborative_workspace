import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  async getHealth() {
    const result = await this.health.check();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
