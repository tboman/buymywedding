"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ebayNotification = exports.ebayMyListings = exports.ebayAuthCallback = exports.ebayAuthRedirect = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const crypto_1 = require("crypto");
const node_fetch_1 = __importDefault(require("node-fetch"));
admin.initializeApp();
const ebayClientId = (0, params_1.defineString)("EBAY_CLIENT_ID");
const ebayClientSecret = (0, params_1.defineSecret)("EBAY_CLIENT_SECRET");
const ebayRedirectUri = (0, params_1.defineString)("EBAY_REDIRECT_URI");
const ebaySandbox = (0, params_1.defineString)("EBAY_SANDBOX", { default: "false" });
const ebayVerificationToken = (0, params_1.defineString)("EBAY_VERIFICATION_TOKEN");
const ebayNotificationEndpoint = (0, params_1.defineString)("EBAY_NOTIFICATION_ENDPOINT");
function ebayUrls() {
    const sandbox = ebaySandbox.value() === "true";
    return {
        auth: sandbox
            ? "https://auth.sandbox.ebay.com/oauth2/authorize"
            : "https://auth.ebay.com/oauth2/authorize",
        token: sandbox
            ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
            : "https://api.ebay.com/identity/v1/oauth2/token",
        user: sandbox
            ? "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/"
            : "https://apiz.ebay.com/commerce/identity/v1/user/",
        publicKey: "https://api.ebay.com/commerce/notification/v1/public_key/",
        browse: sandbox
            ? "https://api.sandbox.ebay.com/buy/browse/v1"
            : "https://api.ebay.com/buy/browse/v1",
    };
}
/**
 * Redirects the user to eBay's OAuth consent page.
 */
exports.ebayAuthRedirect = (0, https_1.onRequest)(async (req, res) => {
    const state = crypto.randomUUID();
    // Store state in Firestore with 10-minute TTL
    await admin.firestore().doc(`ebayAuthStates/${state}`).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 600000),
    });
    const params = new URLSearchParams({
        client_id: ebayClientId.value(),
        redirect_uri: ebayRedirectUri.value(),
        response_type: "code",
        scope: "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
        state,
    });
    res.redirect(`${ebayUrls().auth}?${params.toString()}`);
});
/**
 * Handles eBay's OAuth callback, exchanges the code for tokens,
 * creates/updates a Firebase user, and redirects back to the app.
 */
exports.ebayAuthCallback = (0, https_1.onRequest)({ secrets: [ebayClientSecret] }, async (req, res) => {
    const { code, state } = req.query;
    // Validate CSRF state via Firestore
    if (!state) {
        res.status(403).send("Missing state parameter. Please try signing in again.");
        return;
    }
    const stateRef = admin.firestore().doc(`ebayAuthStates/${state}`);
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists) {
        res.status(403).send("Invalid state parameter. Please try signing in again.");
        return;
    }
    const stateData = stateDoc.data();
    await stateRef.delete(); // one-time use
    if (stateData.expiresAt.toDate() < new Date()) {
        res.status(403).send("State expired. Please try signing in again.");
        return;
    }
    if (!code) {
        res.status(400).send("Missing authorization code.");
        return;
    }
    try {
        // Exchange authorization code for tokens
        const credentials = Buffer.from(`${ebayClientId.value()}:${ebayClientSecret.value()}`).toString("base64");
        const urls = ebayUrls();
        const tokenResponse = await (0, node_fetch_1.default)(urls.token, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: ebayRedirectUri.value(),
            }),
        });
        if (!tokenResponse.ok) {
            const err = await tokenResponse.text();
            console.error("eBay token exchange failed:", err);
            res.status(500).send("Failed to exchange authorization code.");
            return;
        }
        const tokenData = (await tokenResponse.json());
        // Fetch eBay user identity
        const userResponse = await (0, node_fetch_1.default)(urls.user, {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/json",
            },
        });
        if (!userResponse.ok) {
            const err = await userResponse.text();
            console.error("eBay user fetch failed:", err);
            res.status(500).send("Failed to fetch eBay user info.");
            return;
        }
        const ebayUser = (await userResponse.json());
        // Generate avatar from username (eBay doesn't provide profile photos)
        const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(ebayUser.username)}&background=random&size=128`;
        // Create or update Firebase user
        const uid = `ebay:${ebayUser.userId}`;
        const userProps = {
            displayName: ebayUser.username,
            photoURL,
        };
        try {
            await admin.auth().updateUser(uid, userProps);
        }
        catch (e) {
            const error = e;
            if (error.code === "auth/user-not-found") {
                await admin.auth().createUser({ uid, ...userProps });
            }
            else {
                throw e;
            }
        }
        // Store eBay tokens in Firestore for future API use
        await admin.firestore().doc(`ebayTokens/${uid}`).set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Mint a Firebase custom token
        const customToken = await admin.auth().createCustomToken(uid);
        // Redirect back to the app with the token
        res.redirect(`/auth/callback?token=${encodeURIComponent(customToken)}`);
    }
    catch (err) {
        console.error("eBay auth callback error:", err);
        res.status(500).send("Authentication failed. Please try again.");
    }
});
// ── eBay Token Refresh Helper ────────────────────────────────────────
async function getValidEbayToken(uid) {
    const docRef = admin.firestore().doc(`ebayTokens/${uid}`);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new Error("No eBay tokens found for user");
    }
    const data = snap.data();
    const updatedAt = data.updatedAt?.toMillis?.() ?? data.updatedAt;
    const expiresAt = updatedAt + data.expiresIn * 1000 - 60000; // 60s buffer
    if (Date.now() < expiresAt) {
        return data.accessToken;
    }
    // Token expired — refresh it
    const credentials = Buffer.from(`${ebayClientId.value()}:${ebayClientSecret.value()}`).toString("base64");
    const resp = await (0, node_fetch_1.default)(ebayUrls().token, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: data.refreshToken,
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        console.error("eBay token refresh failed:", err);
        throw new Error("Failed to refresh eBay token");
    }
    const tokenData = (await resp.json());
    await docRef.update({
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return tokenData.access_token;
}
// ── eBay My Listings ─────────────────────────────────────────────────
exports.ebayMyListings = (0, https_1.onRequest)({ secrets: [ebayClientSecret] }, async (req, res) => {
    // Verify Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }
    let uid;
    try {
        const decoded = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
        uid = decoded.uid;
    }
    catch {
        res.status(401).json({ error: "Invalid ID token" });
        return;
    }
    try {
        const ebayToken = await getValidEbayToken(uid);
        // Get eBay username from Firebase Auth displayName
        const userRecord = await admin.auth().getUser(uid);
        const username = userRecord.displayName;
        if (!username) {
            res.status(400).json({ error: "No eBay username found" });
            return;
        }
        const urls = ebayUrls();
        const searchParams = new URLSearchParams({
            filter: `sellers:{${username}}`,
            limit: "50",
        });
        const browseResp = await (0, node_fetch_1.default)(`${urls.browse}/item_summary/search?${searchParams}`, {
            headers: {
                Authorization: `Bearer ${ebayToken}`,
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                Accept: "application/json",
            },
        });
        if (!browseResp.ok) {
            const err = await browseResp.text();
            console.error("eBay Browse API error:", err);
            res.status(502).json({ error: "Failed to fetch eBay listings" });
            return;
        }
        const browseData = (await browseResp.json());
        const listings = (browseData.itemSummaries || []).map((item) => ({
            itemId: item.itemId,
            title: item.title,
            price: item.price ? `${item.price.currency} ${item.price.value}` : null,
            image: item.image?.imageUrl || null,
            itemWebUrl: item.itemWebUrl,
            condition: item.condition || null,
        }));
        res.json({ listings, total: browseData.total || 0 });
    }
    catch (err) {
        console.error("ebayMyListings error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ── eBay Platform Notifications ──────────────────────────────────────
/** In-memory public key cache with 1-hour TTL */
const publicKeyCache = new Map();
const KEY_TTL_MS = 60 * 60 * 1000; // 1 hour
async function getEbayPublicKey(kid) {
    const cached = publicKeyCache.get(kid);
    if (cached && Date.now() - cached.fetchedAt < KEY_TTL_MS) {
        return { key: cached.key, algorithm: cached.algorithm };
    }
    const url = `${ebayUrls().publicKey}${kid}`;
    const resp = await (0, node_fetch_1.default)(url, {
        headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
        throw new Error(`Failed to fetch eBay public key ${kid}: ${resp.status}`);
    }
    const data = (await resp.json());
    publicKeyCache.set(kid, { ...data, fetchedAt: Date.now() });
    return { key: data.key, algorithm: data.algorithm };
}
async function verifyEbaySignature(signatureHeader, rawBody) {
    try {
        const decoded = JSON.parse(Buffer.from(signatureHeader, "base64").toString("utf8"));
        const { key, algorithm } = await getEbayPublicKey(decoded.kid);
        const verifier = (0, crypto_1.createVerify)(algorithm === "ECDSA" ? "SHA1" : algorithm);
        verifier.update(rawBody);
        return verifier.verify(key, decoded.signature, "base64");
    }
    catch (err) {
        console.error("eBay signature verification error:", err);
        return false;
    }
}
/**
 * eBay Platform Notification endpoint.
 * GET  — responds to eBay's challenge validation during subscription setup.
 * POST — receives marketplace event notifications.
 */
exports.ebayNotification = (0, https_1.onRequest)(async (req, res) => {
    if (req.method === "GET") {
        const challengeCode = req.query.challenge_code;
        if (!challengeCode) {
            res.status(400).json({ error: "Missing challenge_code" });
            return;
        }
        const hash = (0, crypto_1.createHash)("sha256");
        hash.update(challengeCode);
        hash.update(ebayVerificationToken.value());
        hash.update(ebayNotificationEndpoint.value());
        const challengeResponse = hash.digest("hex");
        res.status(200).json({ challengeResponse });
        return;
    }
    if (req.method === "POST") {
        // Verify signature if present
        const sigHeader = req.headers["x-ebay-signature"];
        let verified = false;
        if (sigHeader && req.rawBody) {
            verified = await verifyEbaySignature(sigHeader, req.rawBody);
        }
        const body = req.body || {};
        const metadata = body.metadata || {};
        await admin.firestore().collection("ebayNotifications").add({
            topic: metadata.topic || null,
            notificationId: metadata.notificationId || null,
            eventDate: metadata.eventDate || null,
            payload: body,
            verified,
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: null,
        });
        res.status(200).json({ status: "ok" });
        return;
    }
    res.status(405).json({ error: "Method not allowed" });
});
//# sourceMappingURL=index.js.map