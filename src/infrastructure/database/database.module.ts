import { Module, Global } from '@nestjs/common';
import { PrismaService, PRISMA_CLIENT } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PRISMA_CLIENT,
      useExisting: PrismaService,
    },
  ],
  exports: [PrismaService, PRISMA_CLIENT],
})
export class DatabaseModule {}
