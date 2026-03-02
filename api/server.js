/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Endless Reward
 * Secure Backend API Server
 * 
 * Features:
 * - IP-based rate limiting (24h window, 10 requests max)
 * - Input sanitization (Arabic text only, no HTML/scripts)
 * - Duplicate detection via SHA-256 hash
 * - Supabase integration with service role
 * - CORS restricted to allowed origins
 * - Security headers via Helmet
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the api directory
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Environment Configuration
// ═══════════════════════════════════════════════════════════════════════════

// Load environment variables (in production, use proper env management)
const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Admin API key for simple authentication
    adminApiKey: process.env.ADMIN_API_KEY || 'change-this-in-production',
    // Production origins - add your Vercel domain here
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5500,http://127.0.0.1:3000').split(','),
    rateLimitWindowHours: parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || '24', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
};

// Validate required configuration
if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase Client (Service Role - Backend Only)
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// Express Application Setup
// ═══════════════════════════════════════════════════════════════════════════

const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════════════════
// Security Middleware
// ═══════════════════════════════════════════════════════════════════════════

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS - Restrict to allowed origins
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (config.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('غير مسموح بالوصول من هذا المصدر'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key'],
    credentials: false,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10kb' }));

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting (IP-based, 24-hour window)
// ═══════════════════════════════════════════════════════════════════════════

const submitLimiter = rateLimit({
    windowMs: config.rateLimitWindowHours * 60 * 60 * 1000, // 24 hours in ms
    max: config.rateLimitMaxRequests, // 10 requests per 24h
    standardHeaders: true,
    legacyHeaders: false,

    // Custom key generator - use IP (does not store permanently)
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
    },

    // Handler for rate limit exceeded
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'تم تجاوز الحد المسموح من المشاركات. يرجى المحاولة لاحقًا.',
        });
    },

    // Skip failed requests from counting
    skipFailedRequests: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Input Validation & Sanitization Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valid content types
 */
const VALID_CONTENT_TYPES = ['dhikr', 'dua', 'ayah', 'hadith', 'benefit'];

/**
 * Content pattern: Arabic, English, numbers, common punctuation, whitespace, emojis
 * Security does NOT depend on this filter — HTML/script stripping + parameterized queries are the real gates.
 */
const CONTENT_PATTERN = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669a-zA-Z0-9\s.,،؛:؟?!()«»\[\]{}\/\-#_…@+=%&*~^\\\n\r🌿💚🤲🕌📖🌙"']+$/;

/**
 * Sanitizes and validates the message content
 * @param {string} input - Raw message input
 * @returns {{ isValid: boolean, sanitized: string, error?: string }}
 */
function sanitizeMessage(input) {
    // Check if input exists and is a string
    if (typeof input !== 'string') {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Reject empty content
    if (!sanitized) {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    // Strip HTML tags (comprehensive pattern)
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove potential script injections
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    // Collapse multiple spaces/newlines
    sanitized = sanitized.replace(/[ \t]+/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Trim again after sanitization
    sanitized = sanitized.trim();

    // Check minimum length (3 characters)
    if (sanitized.length < 3) {
        return { isValid: false, sanitized: '', error: 'المحتوى قصير جدًا' };
    }

    // Check maximum length (1000 characters)
    if (sanitized.length > 1000) {
        return { isValid: false, sanitized: '', error: 'المحتوى طويل جدًا' };
    }

    // Content filter (defense-in-depth)
    if (!CONTENT_PATTERN.test(sanitized)) {
        return { isValid: false, sanitized: '', error: 'المحتوى يحتوي على رموز غير مسموحة' };
    }

    return { isValid: true, sanitized };
}

/**
 * Sanitizes the author name
 * @param {string} input - Raw name input
 * @returns {string|null} - Sanitized name or null
 */
function sanitizeName(input) {
    if (typeof input !== 'string' || !input.trim()) {
        return null;
    }

    let sanitized = input.trim();

    // Strip HTML
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Collapse spaces
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Limit length
    if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100);
    }

    return sanitized || null;
}

/**
 * Generates SHA-256 hash of the message for duplicate detection
 * @param {string} message - Sanitized message
 * @returns {string} - Hex-encoded hash
 */
function generateMessageHash(message) {
    return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/submit
 * Submits a new dhikr/dua/ayah/hadith
 * 
 * Request Body:
 * - message: string (required)
 * - content_type: 'dhikr' | 'dua' | 'ayah' | 'hadith' (required)
 * - author_name: string (optional)
 * 
 * Response:
 * - success: boolean
 * - message: string (Arabic)
 */
app.post('/api/submit', submitLimiter, async (req, res) => {
    try {
        const { message, content_type, author_name } = req.body;

        // ───────────────────────────────────────────────────────────────────
        // 1. Validate content_type
        // ───────────────────────────────────────────────────────────────────
        if (!content_type || !VALID_CONTENT_TYPES.includes(content_type)) {
            return res.status(400).json({
                success: false,
                message: 'يرجى اختيار نوع المحتوى',
            });
        }

        // ───────────────────────────────────────────────────────────────────
        // 2. Sanitize and validate message
        // ───────────────────────────────────────────────────────────────────
        const messageResult = sanitizeMessage(message);
        if (!messageResult.isValid) {
            return res.status(400).json({
                success: false,
                message: messageResult.error,
            });
        }

        // ───────────────────────────────────────────────────────────────────
        // 3. Sanitize author name (optional)
        // ───────────────────────────────────────────────────────────────────
        const sanitizedName = sanitizeName(author_name);

        // ───────────────────────────────────────────────────────────────────
        // 4. Generate message hash for duplicate detection
        // ───────────────────────────────────────────────────────────────────
        const messageHash = generateMessageHash(messageResult.sanitized);

        // ───────────────────────────────────────────────────────────────────
        // 5. Check for duplicate (silent rejection)
        // ───────────────────────────────────────────────────────────────────
        const { data: existingSubmission } = await supabase
            .from('submissions')
            .select('id')
            .eq('message_hash', messageHash)
            .limit(1)
            .single();

        if (existingSubmission) {
            // Silent rejection - return success to prevent probing
            // Do NOT insert duplicate
            return res.json({
                success: true,
                message: 'تم استلام مشاركتك. جزاك الله خيرًا.',
            });
        }

        // ───────────────────────────────────────────────────────────────────
        // 6. Insert into database
        // ───────────────────────────────────────────────────────────────────
        const { error: insertError } = await supabase
            .from('submissions')
            .insert({
                message: messageResult.sanitized,
                content_type: content_type,
                author_name: sanitizedName,
                message_hash: messageHash,
                // status and created_at are handled by database defaults
            });

        if (insertError) {
            // Log error internally (not to client)
            console.error('Database insert error:', insertError.message);

            // Return generic error (no technical details)
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ. يرجى المحاولة لاحقًا.',
            });
        }

        // ───────────────────────────────────────────────────────────────────
        // 7. Success response
        // ───────────────────────────────────────────────────────────────────
        return res.json({
            success: true,
            message: 'تم استلام مشاركتك. جزاك الله خيرًا.',
        });

    } catch (error) {
        // Log unexpected errors internally
        console.error('Unexpected error:', error.message);

        // Return generic error
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ. يرجى المحاولة لاحقًا.',
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// Admin Authentication Middleware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates admin API key from header
 * Simple API key authentication for admin endpoints
 */
function requireAdminAuth(req, res, next) {
    const apiKey = req.headers['x-admin-key'];

    // Debug logging (remove in production)
    console.log('🔐 Auth attempt:');
    console.log('   Received key:', apiKey ? `"${apiKey}"` : 'undefined');
    console.log('   Expected key:', `"${config.adminApiKey}"`);
    console.log('   Match:', apiKey === config.adminApiKey);

    if (!apiKey || apiKey !== config.adminApiKey) {
        return res.status(401).json({
            success: false,
            message: 'غير مصرح بالوصول'
        });
    }

    next();
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin API Routes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/pending
 * Returns all pending submissions for review
 * 
 * Headers:
 * - X-Admin-Key: admin API key
 * 
 * Response:
 * - success: boolean
 * - data: array of pending submissions
 */
app.get('/api/admin/pending', requireAdminAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('submissions')
            .select('id, message, corrected_message, content_type, author_name, created_at')
            .eq('status', 'Pending')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Admin pending query error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب البيانات'
            });
        }

        return res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('Admin pending error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ. يرجى المحاولة لاحقًا.'
        });
    }
});

/**
 * POST /api/admin/approve
 * Approves a submission with optional correction
 * 
 * Headers:
 * - X-Admin-Key: admin API key
 * 
 * Body:
 * - id: string (required) - submission UUID
 * - corrected_message: string (optional) - corrected text
 * 
 * Response:
 * - success: boolean
 * - message: string
 */
app.post('/api/admin/approve', requireAdminAuth, async (req, res) => {
    try {
        const { id, corrected_message } = req.body;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'معرف المشاركة مطلوب'
            });
        }

        // Prepare update data
        const updateData = {
            status: 'Approved',
            reviewed_at: new Date().toISOString()
        };

        // If correction provided, sanitize and add it
        if (corrected_message && typeof corrected_message === 'string') {
            const correctionResult = sanitizeMessage(corrected_message);

            if (!correctionResult.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `خطأ في التصحيح: ${correctionResult.error}`
                });
            }

            updateData.corrected_message = correctionResult.sanitized;
        }

        // Update in database
        const { error } = await supabase
            .from('submissions')
            .update(updateData)
            .eq('id', id)
            .eq('status', 'Pending'); // Only update if still pending

        if (error) {
            console.error('Admin approve error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في تحديث البيانات'
            });
        }

        return res.json({
            success: true,
            message: 'تمت الموافقة على المشاركة'
        });

    } catch (error) {
        console.error('Admin approve error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ. يرجى المحاولة لاحقًا.'
        });
    }
});

/**
 * POST /api/admin/reject
 * Rejects a submission
 * 
 * Headers:
 * - X-Admin-Key: admin API key
 * 
 * Body:
 * - id: string (required) - submission UUID
 * 
 * Response:
 * - success: boolean
 * - message: string
 */
app.post('/api/admin/reject', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.body;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'معرف المشاركة مطلوب'
            });
        }

        // Update in database
        const { error } = await supabase
            .from('submissions')
            .update({
                status: 'Rejected',
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('status', 'Pending'); // Only update if still pending

        if (error) {
            console.error('Admin reject error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في تحديث البيانات'
            });
        }

        return res.json({
            success: true,
            message: 'تم رفض المشاركة'
        });

    } catch (error) {
        console.error('Admin reject error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ. يرجى المحاولة لاحقًا.'
        });
    }
});

/**
 * GET /api/admin/stats
 * Returns submission statistics
 * 
 * Headers:
 * - X-Admin-Key: admin API key
 */
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
        // Get counts by status
        const { data: pending } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Pending');

        const { data: approved } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Approved');

        const { data: rejected } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Rejected');

        return res.json({
            success: true,
            stats: {
                pending: pending?.length || 0,
                approved: approved?.length || 0,
                rejected: rejected?.length || 0
            }
        });

    } catch (error) {
        console.error('Admin stats error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ. يرجى المحاولة لاحقًا.'
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// Error Handling
// ═══════════════════════════════════════════════════════════════════════════

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'الصفحة غير موجودة',
    });
});

// Global error handler
app.use((err, req, res, next) => {
    // Log error internally
    console.error('Global error:', err.message);

    // Return generic error (no stack traces)
    res.status(500).json({
        success: false,
        message: 'حدث خطأ. يرجى المحاولة لاحقًا.',
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Server Startup
// ═══════════════════════════════════════════════════════════════════════════

app.listen(config.port, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🤍 أجر لا ينقطع - Endless Reward API');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📡 Server running on port ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔒 Rate limit: ${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowHours}h`);
    console.log(`✅ Allowed origins: ${config.allowedOrigins.join(', ')}`);
    console.log(`🔑 Admin key loaded: ${config.adminApiKey ? 'Yes (' + config.adminApiKey.substring(0, 3) + '***)' : 'No (using default)'}`);
    console.log('═══════════════════════════════════════════════════════════════');
});

export default app;
