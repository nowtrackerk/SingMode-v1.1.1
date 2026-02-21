# Singmode v.2

The next generation of the ultimate karaoke lounge system. Singmode v.2 provides a professional-grade experience for hosting karaoke parties with real-time synchronization, mobile device connectivity, and advanced queue management.

## Features

- **DAY_SHOW Session Hub**: Manage active broadcasts with custom Room IDs.
- **Mobile Connectivity**: Guests can join instantly via QR code using their own smartphones.
- **Session History**: Archive and browse previous broadcasts.
- **Live Activity Feed**: Monitor connections and system events in real-time.
- **Robust Sync**: Hardened P2P synchronization via PeerJS (STUN/TURN).

## Run Locally

**Prerequisites:** Node.js (v18+)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Ensure the `.env` file contains the correct Firebase configuration.

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the App:**
   Open [http://localhost:5173](http://localhost:5173) in your browser.
