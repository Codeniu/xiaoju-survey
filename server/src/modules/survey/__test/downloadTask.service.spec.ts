import { Test, TestingModule } from '@nestjs/testing';
import { DownloadTaskService } from '../services/downloadTask.service';
import { MongoRepository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DownloadTask } from 'src/models/downloadTask.entity';
import { SurveyResponse } from 'src/models/surveyResponse.entity';
import { ResponseSchemaService } from 'src/modules/surveyResponse/services/responseScheme.service';
import { DataStatisticService } from '../services/dataStatistic.service';
import { FileService } from 'src/modules/file/services/file.service';
import { Logger } from 'src/logger';
import { ObjectId } from 'mongodb';
import { RECORD_STATUS } from 'src/enums';

describe('DownloadTaskService', () => {
  let service: DownloadTaskService;
  let downloadTaskRepository: MongoRepository<DownloadTask>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadTaskService,
        {
          provide: getRepositoryToken(DownloadTask),
          useClass: MongoRepository,
        },
        {
          provide: getRepositoryToken(SurveyResponse),
          useClass: MongoRepository,
        },
        {
          provide: ResponseSchemaService,
          useValue: {
            getResponseSchemaByPageId: jest.fn(),
          },
        },
        {
          provide: DataStatisticService,
          useValue: {
            getDataTable: jest.fn(),
          },
        },
        {
          provide: FileService,
          useValue: {
            upload: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DownloadTaskService>(DownloadTaskService);
    downloadTaskRepository = module.get<MongoRepository<DownloadTask>>(
      getRepositoryToken(DownloadTask),
    );
  });

  describe('createDownloadTask', () => {
    it('should create and save a download task', async () => {
      const mockTaskId = new ObjectId().toString();
      const mockDownloadTask = { _id: new ObjectId(mockTaskId) };
      const mockParams: any = {
        surveyId: 'survey1',
        responseSchema: { title: 'test-title', surveyPath: '/path' },
        creatorId: 'creator1',
        creator: 'creatorName',
        params: { isMasked: true },
      };

      jest
        .spyOn(downloadTaskRepository, 'create')
        .mockReturnValue(mockDownloadTask as any);
      jest
        .spyOn(downloadTaskRepository, 'save')
        .mockResolvedValue(mockDownloadTask as any);

      const result = await service.createDownloadTask(mockParams);

      expect(downloadTaskRepository.create).toHaveBeenCalledWith({
        surveyId: mockParams.surveyId,
        surveyPath: mockParams.responseSchema.surveyPath,
        fileSize: '计算中',
        creatorId: mockParams.creatorId,
        creator: mockParams.creator,
        params: {
          ...mockParams.params,
          title: mockParams.responseSchema.title,
        },
        filename: expect.any(String),
      });
      expect(downloadTaskRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTaskId);
    });
  });

  describe('getDownloadTaskList', () => {
    it('should return task list and total count', async () => {
      const mockCreatorId = 'creator1';
      const mockTasks = [{ _id: '1' }, { _id: '2' }];
      const mockTotal = 2;

      jest
        .spyOn(downloadTaskRepository, 'findAndCount')
        .mockResolvedValue([mockTasks as any, mockTotal]);

      const result = await service.getDownloadTaskList({
        creatorId: mockCreatorId,
        pageIndex: 1,
        pageSize: 10,
      });

      expect(downloadTaskRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          creatorId: mockCreatorId,
          'curStatus.status': { $ne: RECORD_STATUS.REMOVED },
        },
        take: 10,
        skip: 0,
        order: { createDate: -1 },
      });

      expect(result).toEqual({
        total: mockTotal,
        list: mockTasks,
      });
    });
  });

  describe('getDownloadTaskById', () => {
    it('should return task by id', async () => {
      const mockTaskId = new ObjectId().toString();
      const mockTask = { _id: new ObjectId(mockTaskId) };

      jest
        .spyOn(downloadTaskRepository, 'find')
        .mockResolvedValue([mockTask as any]);

      const result = await service.getDownloadTaskById({ taskId: mockTaskId });

      expect(downloadTaskRepository.find).toHaveBeenCalledWith({
        where: { _id: new ObjectId(mockTaskId) },
      });
      expect(result).toEqual(mockTask);
    });

    it('should return null if task is not found', async () => {
      const mockTaskId = new ObjectId().toString();

      jest.spyOn(downloadTaskRepository, 'find').mockResolvedValue([]);

      const result = await service.getDownloadTaskById({ taskId: mockTaskId });

      expect(result).toBeNull();
    });
  });

  describe('deleteDownloadTask', () => {
    it('should update task status to REMOVED', async () => {
      const mockTaskId = new ObjectId().toString();
      const mockUpdateResult = { matchedCount: 1 };

      jest
        .spyOn(downloadTaskRepository, 'updateOne')
        .mockResolvedValue(mockUpdateResult as any);

      const result = await service.deleteDownloadTask({ taskId: mockTaskId });

      expect(downloadTaskRepository.updateOne).toHaveBeenCalledWith(
        {
          _id: new ObjectId(mockTaskId),
          'curStatus.status': { $ne: RECORD_STATUS.REMOVED },
        },
        {
          $set: {
            curStatus: {
              status: RECORD_STATUS.REMOVED,
              date: expect.any(Number),
            },
          },
          $push: { statusList: expect.any(Object) },
        },
      );
      expect(result).toEqual(mockUpdateResult);
    });
  });
});
