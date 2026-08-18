import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationController } from '../../../../src/modules/application/application.controller';
import { ApplicationService } from '../../../../src/modules/application/application.service';
import {
  CreateApplicationDto,
  ApplicationType,
} from '../../../../src/modules/application/dto/create-application.dto';

describe('ApplicationController', () => {
  let controller: ApplicationController;
  let applicationService: jest.Mocked<ApplicationService>;

  const mockApplication = {
    id: 'app-123',
    code: 'WRP001',
    name: 'Wristpay Processor',
    type: 'PROCESSOR',
    apiKey: 'wrp001-api-key-32-characters-xxxxx',
    webhookSecret: 'hst-secret-32-characters-xxxx',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockApplicationService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationController],
      providers: [
        {
          provide: ApplicationService,
          useValue: mockApplicationService,
        },
      ],
    }).compile();

    controller = module.get<ApplicationController>(ApplicationController);
    applicationService = module.get(ApplicationService);
  });

  describe('create', () => {
    it('should create an application successfully', async () => {
      const createdApplication: Awaited<
        ReturnType<ApplicationService['create']>
      > = {
        ...mockApplication,
        allowedIps: ['127.0.0.1'],
      };

      // Use the mock directly - applicationService.create is already a jest mock
      applicationService.create.mockResolvedValue(createdApplication);

      const dto: CreateApplicationDto = {
        code: 'WRP001',
        name: 'Wristpay Processor',
        type: ApplicationType.PROCESSOR,
        apiKey: 'wrp001-api-key-32-characters-xxxxx',
        webhookSecret: 'hst-secret-32-characters-xxxx',
      };

      const result = await controller.create(dto);

      expect(result).toEqual({
        id: mockApplication.id,
        code: mockApplication.code,
        name: mockApplication.name,
        type: mockApplication.type,
        apiKey: mockApplication.apiKey,
        webhookSecret: mockApplication.webhookSecret,
        isActive: mockApplication.isActive,
        createdAt: mockApplication.createdAt,
      });
      expect(applicationService.create).toHaveBeenCalledWith(dto);
    });

    it('should create an application successfully using readonly mock data', async () => {
      const mockCreatedApplication: Awaited<
        ReturnType<ApplicationService['create']>
      > = {
        id: 'app-456',
        code: 'WRP002',
        name: 'Wristpay Processor 2',
        type: 'PROCESSOR',
        apiKey: 'wrp002-api-key-32-characters-xxxxx',
        webhookSecret: 'hst-secret-32-characters-yyyy',
        isActive: true,
        allowedIps: ['127.0.0.1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Use the mock directly
      applicationService.create.mockResolvedValue(mockCreatedApplication);
      const dto: CreateApplicationDto = {
        code: 'WRP002',
        name: 'Wristpay Processor 2',
        type: ApplicationType.PROCESSOR,
        apiKey: 'wrp002-api-key-32-characters-xxxxx',
        webhookSecret: 'hst-secret-32-characters-yyyy',
      };

      await expect(controller.create(dto)).resolves.toMatchObject({
        code: dto.code,
        name: dto.name,
        type: dto.type,
      });
    });
  });
});
