require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 6319246165;
const PORT = process.env.PORT || 3000;
const ENVIRONMENT = process.env.ENVIRONMENT || 'polling';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Validate bot token
if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN environment variable is not set');
  process.exit(1);
}

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, {
  polling: ENVIRONMENT === 'polling'
});

// Initialize Express
const app = express();
app.use(express.json());

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'bot.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize Database Tables
function initializeDatabase() {
  db.run(
    `CREATE TABLE IF NOT EXISTS files (
      slug TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      file_type TEXT NOT NULL,
      caption TEXT
    )`,
    (err) => {
      if (err) {
        console.error('Error creating table:', err);
      } else {
        console.log('Files table ready');
        insertTestData();
      }
    }
  );
}

// Insert test data
function insertTestData() {
  const testData = {
    slug: 'testvideo1',
    file_id: 'BAACAgUAAxkBAAFB_0RpiGfUbmP3qEmL5Ow7yXm3XepUmAACCxwAAmngSVR8hHWXDZZRIToE',
    file_type: 'video',
    caption: 'Id:2001'
  };

  db.get(
    'SELECT * FROM files WHERE slug = ?',
    [testData.slug],
    (err, row) => {
      if (err) {
        console.error('Error checking test data:', err);
        return;
      }

      if (!row) {
        db.run(
          'INSERT INTO files (slug, file_id, file_type, caption) VALUES (?, ?, ?, ?)',
          [testData.slug, testData.file_id, testData.file_type, testData.caption],
          (err) => {
            if (err) {
              console.error('Error inserting test data:', err);
            } else {
              console.log('Test data inserted successfully');
            }
          }
        );
      } else {
        console.log('Test data already exists');
      }
    }
  );
}

// Helper function to check if user is admin
function isAdmin(userId) {
  return userId === ADMIN_ID;
}

// Helper function to run database query
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper function to get database row
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to get all database rows
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Parse commands from message text
function parseCommand(text) {
  const parts = text.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);
  return { command, args };
}

// Handle /start command
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const slug = match[1] || null;

  if (slug) {
    try {
      const file = await dbGet('SELECT * FROM files WHERE slug = ?', [slug]);

      if (!file) {
        bot.sendMessage(chatId, '❌ File not found!');
        return;
      }

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '📹 Send me',
              callback_data: slug
            }
          ]
        ]
      };

      bot.sendMessage(
        chatId,
        `📄 ${file.caption || 'File available'}`,
        {
          reply_markup: inlineKeyboard
        }
      );
    } catch (error) {
      console.error('Error in /start command:', error);
      bot.sendMessage(chatId, '❌ Error retrieving file');
    }
  } else {
    const message =
      `🤖 Welcome to SorryBabu Bot!\n\n` +
      `I can help you share and retrieve files securely.\n\n` +
      `📌 Test the bot:\n` +
      `Use: https://t.me/sorrybabubot?start=testvideo1\n\n` +
      `💡 Commands:\n` +
      `/start <slug> - Get a file\n` +
      `/help - Show help`;

    bot.sendMessage(chatId, message);
  }
});

// Handle /add command (admin only)
bot.onText(/\/add\s+(\S+)\s+(\S+)\s+(photo|video|document)\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this command');
    return;
  }

  const slug = match[1];
  const fileId = match[2];
  const fileType = match[3];
  const caption = match[4];

  try {
    // Check if slug already exists
    const existing = await dbGet('SELECT * FROM files WHERE slug = ?', [slug]);

    if (existing) {
      bot.sendMessage(chatId, `❌ Slug "${slug}" already exists!`);
      return;
    }

    await dbRun(
      'INSERT INTO files (slug, file_id, file_type, caption) VALUES (?, ?, ?, ?)',
      [slug, fileId, fileType, caption]
    );

    const deepLink = `https://t.me/sorrybabubot?start=${slug}`;
    const message =
      `✅ File added successfully!\n\n` +
      `📋 Details:\n` +
      `Slug: <code>${slug}</code>\n` +
      `Type: ${fileType}\n` +
      `Caption: ${caption}\n\n` +
      `🔗 Share link:\n` +
      `<code>${deepLink}</code>`;

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in /add command:', error);
    bot.sendMessage(chatId, '❌ Error adding file');
  }
});

// Handle /status command (admin only)
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ You are not authorized to use this command');
    return;
  }

  try {
    const files = await dbAll('SELECT COUNT(*) as count FROM files');
    const count = files[0].count;

    const message =
      `📊 Bot Status\n\n` +
      `📦 Total files: <b>${count}</b>\n` +
      `🤖 Bot: <b>Active</b>\n` +
      `⚙️ Environment: <b>${ENVIRONMENT}</b>`;

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in /status command:', error);
    bot.sendMessage(chatId, '❌ Error retrieving status');
  }
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpMessage =
    `📚 Available Commands:\n\n` +
    `/start <slug> - Get a file by slug\n` +
    `/help - Show this message\n\n` +
    `👨‍💼 Admin Commands:\n` +
    `/add <slug> <file_id> <type> <caption> - Add a new file\n` +
    `/status - Show bot status`;

  bot.sendMessage(chatId, helpMessage);
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const slug = query.data;

  try {
    const file = await dbGet('SELECT * FROM files WHERE slug = ?', [slug]);

    if (!file) {
      bot.answerCallbackQuery(query.id, { text: '❌ File not found!' });
      return;
    }

    bot.answerCallbackQuery(query.id, { text: '⏳ Sending file...' });

    // Send file based on type
    switch (file.file_type) {
      case 'photo':
        bot.sendPhoto(chatId, file.file_id, { caption: file.caption || '' });
        break;
      case 'video':
        bot.sendVideo(chatId, file.file_id, { caption: file.caption || '' });
        break;
      case 'document':
        bot.sendDocument(chatId, file.file_id, { caption: file.caption || '' });
        break;
      default:
        bot.sendMessage(chatId, '❌ Unknown file type');
    }
  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(query.id, { text: '❌ Error sending file!' });
  }
});

// Webhook endpoint for production
app.post(`/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SorryBabu Bot',
    status: 'running',
    environment: ENVIRONMENT,
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Environment: ${ENVIRONMENT}`);

  if (ENVIRONMENT === 'webhook' && WEBHOOK_URL) {
    bot.setWebHook(`${WEBHOOK_URL}/${BOT_TOKEN}`);
    console.log(`🔗 Webhook set to: ${WEBHOOK_URL}/${BOT_TOKEN}`);
  } else if (ENVIRONMENT === 'polling') {
    console.log('📞 Polling mode active');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
  process.exit(0);
});
