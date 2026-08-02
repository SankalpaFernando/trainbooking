import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Request, Response } from 'express';
import createWriteStream  from 'pino-loki';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { context, trace } from '@opentelemetry/api';

const serviceName = process.env.OTEL_SERVICE_NAME || 'railway-booking-backend';

const lokiStream = createWriteStream({
  host: process.env.LOKI_URL || 'http://loki:3100',
  labels: { service: serviceName },
  timeout: 10000,
});

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: serviceName,
  },
}, lokiStream);

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req: Request, res: Response) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (_req: Request, res: Response) => {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    return {
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      statusCode: res.statusCode,
    };
  },
  serializers: {
    req: (req: Request) => ({ method: req.method, url: req.url, headers: req.headers }),
    res: (res: Response) => ({ statusCode: res.statusCode }),
  },
  stream: lokiStream,
});

collectDefaultMetrics({ register });

export const bookingStatusCounter = new Counter({
  name: 'railway_seat_bookings_total',
  help: 'Total number of seat bookings by status',
  labelNames: ['status'],
});

export const occupancyRatioGauge = new Gauge({
  name: 'railway_segment_occupancy_ratio',
  help: 'Occupancy ratio for a segment range',
  labelNames: ['start_station', 'end_station'],
});

export const lockAcquisitionHistogram = new Histogram({
  name: 'railway_lock_acquisition_duration_seconds',
  help: 'Redis lock acquisition duration in seconds',
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const requestDurationHistogram = new Histogram({
  name: 'railway_api_request_duration_seconds',
  help: 'API request duration histogram in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const cacheHitsCounter = new Counter({
  name: 'railway_cqrs_cache_hits_total',
  help: 'Total number of CQRS cache hits',
});

export const cacheMissesCounter = new Counter({
  name: 'railway_cqrs_cache_misses_total',
  help: 'Total number of CQRS cache misses',
});

export const registerMetrics = () => register;

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4318/v1/traces',
});

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});
