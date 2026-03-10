import { query } from './postgres';
import { logger } from './logger';
import { randomBytes } from 'crypto';

// 인스턴스 ID 생성 (서버 시작시 한번만)
const instanceId = `instance-${Date.now()}-${randomBytes(6).toString('hex')}`;
const startTime = new Date();

// 인스턴스 정보
export const getInstanceInfo = () => ({
  instanceId,
  startTime,
  hostname: process.env.HOSTNAME || 'localhost',
  port: process.env.PORT || 3000,
  pid: process.pid,
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
});

// 로그 레벨
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

// 로그 저장 (model_logs 테이블에 통합)
export async function logToDatabase(level, message, metadata = {}) {
  try {
    const logMetadata = {
      ...metadata,
      hostname: process.env.HOSTNAME || 'localhost',
      pid: process.pid,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };

    await query(
      `INSERT INTO model_logs (instance_id, instance_type, level, category, message, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        instanceId,
        'app-instance',
        level,
        'system_event',
        message,
        JSON.stringify(logMetadata),
      ]
    );

    // winston logger로 출력 (안전하게 처리)
    try {
      const logLevel = level.toLowerCase();
      if (logger[logLevel]) {
        logger[logLevel](`[${instanceId}] ${message}`, metadata);
      } else {
        logger.info(`[${instanceId}] ${message}`, metadata);
      }
    } catch (loggerError) {
      // logger가 이미 종료된 경우 무시
      console.error(`[${instanceId}] Logger 출력 실패 (무시됨):`, loggerError.message);
    }
  } catch (error) {
    // logger.error 호출도 안전하게 처리
    try {
      logger.error('로그 저장 실패', {
        error: error.message,
        stack: error.stack,
      });
    } catch (loggerError) {
      // logger가 이미 종료된 경우 console.error 사용
      console.error('로그 저장 실패 (logger 종료됨):', error.message);
    }
  }
}

// 인스턴스 상태 업데이트 (heartbeat)
export async function updatemodelServerstatus() {
  try {
    const instanceInfo = getInstanceInfo();
    const instanceData = {
      instanceId,
      instanceType: instanceInfo.instanceType || 'app-instance',
      hostname: instanceInfo.hostname,
      port: instanceInfo.port,
      pid: instanceInfo.pid,
      nodeVersion: instanceInfo.nodeVersion,
      environment: instanceInfo.environment,
      lastHeartbeat: new Date(),
      uptime: Date.now() - startTime.getTime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    await query(
      `INSERT INTO model_server_status 
       (instance_id, instance_type, hostname, port, pid, node_version, environment, 
        last_heartbeat, uptime, memory_usage, cpu_usage, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       ON CONFLICT (instance_id) 
       DO UPDATE SET 
         instance_type = EXCLUDED.instance_type,
         hostname = EXCLUDED.hostname,
         port = EXCLUDED.port,
         pid = EXCLUDED.pid,
         node_version = EXCLUDED.node_version,
         environment = EXCLUDED.environment,
         last_heartbeat = EXCLUDED.last_heartbeat,
         uptime = EXCLUDED.uptime,
         memory_usage = EXCLUDED.memory_usage,
         cpu_usage = EXCLUDED.cpu_usage,
         updated_at = CURRENT_TIMESTAMP`,
      [
        instanceData.instanceId,
        instanceData.instanceType,
        instanceData.hostname,
        instanceData.port,
        instanceData.pid,
        instanceData.nodeVersion,
        instanceData.environment,
        instanceData.lastHeartbeat,
        instanceData.uptime,
        JSON.stringify(instanceData.memoryUsage),
        JSON.stringify(instanceData.cpuUsage),
      ]
    );
  } catch (error) {
    // logger.error 호출도 안전하게 처리
    try {
      logger.error('인스턴스 상태 업데이트 실패', {
        error: error.message,
        instanceId,
      });
    } catch (loggerError) {
      // logger가 이미 종료된 경우 console.error 사용
      console.error('인스턴스 상태 업데이트 실패 (logger 종료됨):', error.message);
    }
  }
}

// 편의 함수들
export const logError = (message, metadata) =>
  logToDatabase(LogLevel.ERROR, message, metadata);
export const logWarn = (message, metadata) =>
  logToDatabase(LogLevel.WARN, message, metadata);
export const logInfo = (message, metadata) =>
  logToDatabase(LogLevel.INFO, message, metadata);
export const logDebug = (message, metadata) =>
  logToDatabase(LogLevel.DEBUG, message, metadata);

// 서버 시작 시 자동 실행
if (typeof window === 'undefined') {
  // 인스턴스 등록
  updatemodelServerstatus();

  // 5분마다 heartbeat
  setInterval(updatemodelServerstatus, 5 * 60 * 1000);

  // 시작 로그
  logInfo('인스턴스 시작됨', getInstanceInfo());

  // 프로세스 종료 시 정리 (logger 종료 전에 호출되도록 주의)
  const shutdownHandler = async (signal) => {
    try {
      // logger가 종료되기 전에 로그 기록 시도
      await logInfo(`인스턴스 종료됨 (${signal})`);
    } catch (error) {
      // logger가 이미 종료된 경우 무시
      console.log(`인스턴스 종료됨 (${signal})`);
    }
  };

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
}
