'use strict';

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

const WIDTH = 1400;
const HEIGHT = 600;
const ASSETS = path.join(__dirname, '..', 'assets');
const CHUD_PATH = path.join(ASSETS, 'chud.png');
const HEART_PATH = path.join(ASSETS, 'heart.png');
const FONT_PATH = path.join(ASSETS, 'fonts', 'La Femina.ttf');
const FONT_FAMILY = 'La Femina';

try {
  GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
} catch (error) {
  console.warn('[WelcomeImage] Could not register La Femina:', error.message);
}

function font(size, weight = '') {
  return `${weight} ${size}px "${FONT_FAMILY}"`.trim();
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function drawCircularImage(ctx, image, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawPlaceholder(ctx, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#d9d2c1';
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.fillStyle = '#b8ac92';
  ctx.beginPath();
  ctx.arc(x, y - radius * 0.28, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + radius * 1.35, radius * 0.95, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

async function loadAvatar(avatarURL) {
  if (!avatarURL) return null;
  try {
    const response = await fetch(avatarURL);
    if (!response.ok) return null;
    return loadImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return null;
  }
}

async function generateWelcomeImage({ username, serverName, avatarURL }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const [chud, heart, avatar] = await Promise.all([
    loadImage(CHUD_PATH),
    loadImage(HEART_PATH),
    loadAvatar(avatarURL),
  ]);

  ctx.fillStyle = '#f6f1e7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(100,75,30,0.12)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let index = 0; index < 90; index += 1) {
    const size = randomBetween(12, 30);
    ctx.save();
    ctx.globalAlpha = randomBetween(0.4, 0.95);
    ctx.translate(randomBetween(0, WIDTH), randomBetween(0, HEIGHT));
    ctx.rotate(randomBetween(-0.6, 0.6));
    ctx.drawImage(heart, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  const sideHeight = HEIGHT * 0.95;
  const sideWidth = sideHeight * (chud.width / chud.height);
  ctx.drawImage(chud, -sideWidth * 0.22, HEIGHT - sideHeight, sideWidth, sideHeight);
  ctx.save();
  ctx.translate(WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(chud, -sideWidth * 0.22, HEIGHT - sideHeight, sideWidth, sideHeight);
  ctx.restore();

  const topHeight = HEIGHT * 0.42;
  const topWidth = topHeight * (chud.width / chud.height);
  ctx.drawImage(chud, WIDTH / 2 - topWidth / 2, -topHeight * 0.3, topWidth, topHeight);

  const avatarX = WIDTH / 2;
  const avatarY = 190;
  const avatarRadius = 110;
  ctx.save();
  ctx.shadowColor = 'rgba(90,70,30,0.35)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (avatar) drawCircularImage(ctx, avatar, avatarX, avatarY, avatarRadius);
  else drawPlaceholder(ctx, avatarX, avatarY, avatarRadius);

  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 6, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#8a6a2f';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3f2f14';
  ctx.font = font(52, 'bold');
  ctx.fillText(String(username).slice(0, 32), WIDTH / 2, 390);
  ctx.fillStyle = '#5c4726';
  ctx.font = font(38);
  ctx.fillText(`Welcome to ${String(serverName).slice(0, 42)}`, WIDTH / 2, 460);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWelcomeImage };
