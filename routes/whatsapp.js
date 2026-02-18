/**
 * ============================================
 * WHATSAPP CHAT ROUTES - CRM Integration
 * ============================================
 * Tables: wa_conversations, wa_messages, wa_stage_history
 * Real-time via Socket.IO
 */
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Stage definitions
const STAGES = {
  contacto_inicial:  { label: 'Contacto Inicial', color: '#6B7280', icon: '👋', order: 1 },
  seleccion_modelo:  { label: 'Selección de Modelo', color: '#3B82F6', icon: '🚗', order: 2 },
  cotizacion:        { label: 'Cotización', color: '#8B5CF6', icon: '💰', order: 3 },
  datos_personales:  { label: 'Datos Personales', color: '#F59E0B', icon: '📋', order: 4 },
  reserva:           { label: 'Reserva / Pago', color: '#10B981', icon: '✅', order: 5 },
  derivado:          { label: 'Derivado a Humano', color: '#EF4444', icon: '🧑', order: 6 },
  sin_respuesta:     { label: 'Sin Respuesta', color: '#9CA3AF', icon: '⏳', order: 7 },
  cerrado:           { label: 'Cerrado', color: '#1F2937', icon: '🏁', order: 8 },
};

module.exports = function(pool) {
  const getIO = (req) => req.app.get('io');

  // ==================== INIT TABLES ====================
  async function initWhatsAppTables() {
    const conn = await pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS wa_conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(200),
          stage VARCHAR(50) DEFAULT 'contacto_inicial',
          model_interest VARCHAR(200),
          assigned_to INT NULL,
          human_takeover BOOLEAN DEFAULT FALSE,
          bot_enabled BOOLEAN DEFAULT TRUE,
          lead_data JSON,
          last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_phone (phone),
          INDEX idx_stage (stage),
          INDEX idx_assigned (assigned_to),
          INDEX idx_last_msg (last_message_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS wa_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          phone VARCHAR(50) NOT NULL,
          direction ENUM('in', 'out') NOT NULL,
          sender ENUM('client', 'bot', 'human') DEFAULT 'client',
          sender_user_id INT NULL,
          content TEXT NOT NULL,
          stage_at_time VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_conv (conversation_id),
          INDEX idx_created (created_at),
          FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS wa_stage_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          from_stage VARCHAR(50),
          to_stage VARCHAR(50) NOT NULL,
          changed_by VARCHAR(100) DEFAULT 'bot',
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ WhatsApp tables initialized');
    } catch (err) {
      console.error('Error creating WhatsApp tables:', err.message);
    } finally {
      conn.release();
    }
  }

  // Run on startup
  initWhatsAppTables();

  // ==================== STAGES ====================
  router.get('/stages', (req, res) => {
    res.json(STAGES);
  });

  // ==================== CONVERSATIONS ====================

  // List all conversations
  router.get('/conversations', authMiddleware, async (req, res) => {
    try {
      const { stage, search, assigned } = req.query;
      let sql = `
        SELECT c.*,
          u.name AS assigned_name,
          (SELECT content FROM wa_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT COUNT(*) FROM wa_messages m WHERE m.conversation_id = c.id AND m.direction = 'in'
            AND m.created_at > COALESCE(
              (SELECT MAX(m2.created_at) FROM wa_messages m2 WHERE m2.conversation_id = c.id AND m2.direction = 'out' AND m2.sender = 'human'),
              '1970-01-01'
            )
          ) AS unread_count
        FROM wa_conversations c
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE 1=1
      `;
      const params = [];

      if (stage && stage !== 'all') {
        sql += ' AND c.stage = ?';
        params.push(stage);
      }
      if (search) {
        sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.model_interest LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      if (assigned) {
        sql += ' AND c.assigned_to = ?';
        params.push(assigned);
      }

      sql += ' ORDER BY c.last_message_at DESC';

      const [rows] = await pool.query(sql, params);
      
      // Parse lead_data JSON
      const conversations = rows.map(r => ({
        ...r,
        lead_data: typeof r.lead_data === 'string' ? JSON.parse(r.lead_data || '{}') : (r.lead_data || {}),
      }));

      res.json(conversations);
    } catch (err) {
      console.error('Error getting conversations:', err);
      res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
  });

  // Get single conversation with messages + timeline
  router.get('/conversations/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const [convRows] = await pool.query(`
        SELECT c.*, u.name AS assigned_name
        FROM wa_conversations c
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE c.id = ?
      `, [id]);

      if (convRows.length === 0) return res.status(404).json({ error: 'No encontrada' });

      const [messages] = await pool.query(
        'SELECT * FROM wa_messages WHERE conversation_id = ? ORDER BY created_at ASC', [id]
      );

      const [timeline] = await pool.query(
        'SELECT * FROM wa_stage_history WHERE conversation_id = ? ORDER BY created_at ASC', [id]
      );

      const conv = convRows[0];
      conv.lead_data = typeof conv.lead_data === 'string' ? JSON.parse(conv.lead_data || '{}') : (conv.lead_data || {});

      res.json({ conversation: conv, messages, timeline });
    } catch (err) {
      console.error('Error getting conversation:', err);
      res.status(500).json({ error: 'Error' });
    }
  });

  // Send message from CRM (human agent)
  router.post('/conversations/:id/send', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const user = req.user;

      if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

      const [convRows] = await pool.query('SELECT * FROM wa_conversations WHERE id = ?', [id]);
      if (convRows.length === 0) return res.status(404).json({ error: 'No encontrada' });

      const conv = convRows[0];

      // TODO: Send via BotMaker API
      // await sendBotmakerMessage(conv.phone, message);

      // Save message
      const [result] = await pool.query(
        `INSERT INTO wa_messages (conversation_id, phone, direction, sender, sender_user_id, content, stage_at_time)
         VALUES (?, ?, 'out', 'human', ?, ?, ?)`,
        [id, conv.phone, user.id, message, conv.stage]
      );

      const [msgRows] = await pool.query('SELECT * FROM wa_messages WHERE id = ?', [result.insertId]);
      const savedMsg = msgRows[0];

      // Mark human takeover
      if (!conv.human_takeover) {
        await pool.query(
          'UPDATE wa_conversations SET human_takeover = TRUE, bot_enabled = FALSE, assigned_to = ?, updated_at = NOW() WHERE id = ?',
          [user.id, id]
        );
      }

      await pool.query('UPDATE wa_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?', [id]);

      // Real-time
      const io = getIO(req);
      if (io) {
        io.emit('wa:new_message', { conversation_id: parseInt(id), message: savedMsg });
        io.emit('wa:conversation_updated', { id: parseInt(id) });
      }

      res.json(savedMsg);
    } catch (err) {
      console.error('Error sending message:', err);
      res.status(500).json({ error: 'Error' });
    }
  });

  // Update stage
  router.put('/conversations/:id/stage', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, note } = req.body;

      if (!STAGES[stage]) return res.status(400).json({ error: 'Etapa inválida' });

      const [convRows] = await pool.query('SELECT stage FROM wa_conversations WHERE id = ?', [id]);
      if (convRows.length === 0) return res.status(404).json({ error: 'No encontrada' });

      const fromStage = convRows[0].stage;

      await pool.query('UPDATE wa_conversations SET stage = ?, updated_at = NOW() WHERE id = ?', [stage, id]);
      await pool.query(
        'INSERT INTO wa_stage_history (conversation_id, from_stage, to_stage, changed_by, note) VALUES (?, ?, ?, ?, ?)',
        [id, fromStage, stage, req.user.name || 'manual', note || null]
      );

      const io = getIO(req);
      if (io) {
        io.emit('wa:stage_changed', { conversation_id: parseInt(id), from: fromStage, to: stage });
        io.emit('wa:conversation_updated', { id: parseInt(id) });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating stage:', err);
      res.status(500).json({ error: 'Error' });
    }
  });

  // Assign conversation
  router.put('/conversations/:id/assign', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      await pool.query('UPDATE wa_conversations SET assigned_to = ?, updated_at = NOW() WHERE id = ?', [userId || null, id]);

      const io = getIO(req);
      if (io) io.emit('wa:conversation_updated', { id: parseInt(id) });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Error' });
    }
  });

  // Toggle bot
  router.put('/conversations/:id/bot', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      await pool.query(
        'UPDATE wa_conversations SET bot_enabled = ?, human_takeover = ?, updated_at = NOW() WHERE id = ?',
        [enabled, !enabled, id]
      );

      const io = getIO(req);
      if (io) io.emit('wa:conversation_updated', { id: parseInt(id) });

      res.json({ success: true, bot_enabled: enabled });
    } catch (err) {
      res.status(500).json({ error: 'Error' });
    }
  });

  // ==================== WEBHOOK (BotMaker → CRM) ====================
  router.post('/webhook', async (req, res) => {
    try {
      const { phone, name, message, direction, stage, model_interest, lead_data } = req.body;

      if (!phone || !message) return res.status(400).json({ error: 'phone y message requeridos' });

      // Find or create
      let [convRows] = await pool.query('SELECT * FROM wa_conversations WHERE phone = ?', [phone]);
      let isNew = false;

      if (convRows.length === 0) {
        const [result] = await pool.query(
          "INSERT INTO wa_conversations (phone, name, stage, lead_data) VALUES (?, ?, 'contacto_inicial', '{}')",
          [phone, name || phone]
        );
        [convRows] = await pool.query('SELECT * FROM wa_conversations WHERE id = ?', [result.insertId]);
        isNew = true;
      }

      const conv = convRows[0];
      const convId = conv.id;
      const currentStage = conv.stage;

      // Save message
      await pool.query(
        `INSERT INTO wa_messages (conversation_id, phone, direction, sender, content, stage_at_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [convId, phone, direction || 'in', direction === 'out' ? 'bot' : 'client', message, currentStage]
      );

      // Build update
      const updates = ['last_message_at = NOW()'];
      const params = [];

      if (name && name !== conv.name) {
        updates.push('name = ?');
        params.push(name);
      }
      if (model_interest) {
        updates.push('model_interest = ?');
        params.push(model_interest);
      }
      if (lead_data && Object.keys(lead_data).length > 0) {
        const existing = typeof conv.lead_data === 'string' ? JSON.parse(conv.lead_data || '{}') : (conv.lead_data || {});
        const merged = { ...existing, ...lead_data };
        updates.push('lead_data = ?');
        params.push(JSON.stringify(merged));
      }
      if (stage && stage !== currentStage && STAGES[stage]) {
        updates.push('stage = ?');
        params.push(stage);
        await pool.query(
          'INSERT INTO wa_stage_history (conversation_id, from_stage, to_stage, changed_by) VALUES (?, ?, ?, ?)',
          [convId, currentStage, stage, 'bot']
        );
      }

      params.push(convId);
      await pool.query(`UPDATE wa_conversations SET ${updates.join(', ')} WHERE id = ?`, params);

      // Get saved message for emit
      const [savedRows] = await pool.query(
        'SELECT * FROM wa_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', [convId]
      );

      // Real-time
      const io = req.app.get('io');
      if (io) {
        io.emit('wa:new_message', { conversation_id: convId, message: savedRows[0] });
        io.emit('wa:conversation_updated', { id: convId });
        if (isNew) io.emit('wa:new_conversation', { id: convId, phone, name: name || phone });
      }

      // Return bot status
      const [updated] = await pool.query('SELECT bot_enabled, human_takeover FROM wa_conversations WHERE id = ?', [convId]);

      res.json({
        success: true,
        conversation_id: convId,
        bot_enabled: updated[0].bot_enabled,
        human_takeover: updated[0].human_takeover,
      });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({ error: 'Error' });
    }
  });

  // Stats
  router.get('/stats', authMiddleware, async (req, res) => {
    try {
      const [byStage] = await pool.query(`
        SELECT stage, COUNT(*) as count FROM wa_conversations
        WHERE last_message_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY stage
      `);
      const [total] = await pool.query('SELECT COUNT(*) as count FROM wa_conversations');
      const [today] = await pool.query("SELECT COUNT(*) as count FROM wa_conversations WHERE DATE(created_at) = CURDATE()");

      res.json({ by_stage: byStage, total: total[0].count, today: today[0].count });
    } catch (err) {
      res.status(500).json({ error: 'Error' });
    }
  });

  return router;
};
