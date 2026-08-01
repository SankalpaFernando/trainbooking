import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/apiRoutes';
import { BookingService } from './services/bookingService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'Sri Lanka Railway Seat Booking Engine', timestamp: new Date() });
});

// API Routes
app.use('/api', apiRouter);

// Start background cron worker for hold auto-expiry
setInterval(() => {
  BookingService.expirePendingHolds().catch((err) => {
    console.error('Error during pending hold auto-expiry worker run:', err);
  });
}, 15000);

app.listen(PORT, () => {
  console.log(`🚂 Railway Seat Booking API Server running on port ${PORT}`);
});
