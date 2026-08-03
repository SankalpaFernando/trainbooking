import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/apiRoutes';
import { BookingService } from './services/bookingService';
import { httpLogger, logger, registerMetrics, sdk } from './services/observability';

dotenv.config();

sdk.start()

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(httpLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'Sri Lanka Railway Seat Booking Engine', timestamp: new Date() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registerMetrics().contentType);
  res.end(await registerMetrics().metrics());
});

app.use('/api', apiRouter);

setInterval(() => {
  BookingService.expirePendingHolds().catch((err) => {
    logger.error({ err }, 'Error during pending hold auto-expiry worker run');
  });
}, 15000);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Railway Seat Booking API Server running');
});
