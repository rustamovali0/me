const { PKPass } = require('passkit-generator');

const iconPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABg3Am1AAAAvUlEQVRoge3ZsQ2AIBAF0X9nYtFOtBOtQDvRTrQTrULbQFLR0QQMMRjOPZcn4B8Pmdx7gTEz8D7nAKZg6QeAoh6gqAco6gGKeoCiHqCoByjqAYp6gKIeoKgHKOoBinqAoh6gqAco6gGKeoCiHqCoByjqAYp6gKIeoKgHKOoBinqAoh6gqAco6gGKeoCiHqCoByjqAYp6gKIeoKgHKOoBinqAoh6gqAco6gGKeoCiHqCoByjqAYp6gKIe8wA8+QJGxwA9hwAAAABJRU5ErkJggg==',
  'base64'
);

const card = {
  fileName: 'Ali_Rustamov_Wallet.pkpass',
  serialPrefix: 'me-rustamoff',
  organizationName: 'Rustamoff',
  description: 'Əli Rüstəmov rəqəmsal vizitkartı',
  logoText: 'Rustamoff',
  backgroundColor: 'rgb(246, 247, 243)',
  foregroundColor: 'rgb(25, 27, 28)',
  labelColor: 'rgb(18, 60, 53)',
  name: 'Əli Rüstəmov',
  title: 'Şəxsi profil',
  phone: '+994773313327',
  email: 'me@rustamoff.site',
  url: 'https://me.rustamoff.site/'
};

function cert(name) {
  const value = process.env[name];
  if (!value) return '';
  if (value.includes('BEGIN ')) return value.replace(/\\n/g, '\n');
  try {
    return Buffer.from(value, 'base64').toString('utf8').replace(/\\n/g, '\n');
  } catch {
    return value.replace(/\\n/g, '\n');
  }
}

function requiredEnv() {
  return {
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER || process.env.PASS_TYPE_IDENTIFIER,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER || process.env.TEAM_IDENTIFIER,
    wwdr: cert('APPLE_WWDR_CERT'),
    signerCert: cert('APPLE_SIGNER_CERT'),
    signerKey: cert('APPLE_SIGNER_KEY'),
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || process.env.SIGNER_KEY_PASSPHRASE || ''
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const env = requiredEnv();
  const missing = Object.entries(env)
    .filter(([key, value]) => key !== 'signerKeyPassphrase' && !value)
    .map(([key]) => key);

  if (missing.length) {
    return res.status(501).json({
      error: 'Apple Wallet sertifikatları hazır deyil.',
      missing,
      requiredEnv: [
        'APPLE_PASS_TYPE_IDENTIFIER',
        'APPLE_TEAM_IDENTIFIER',
        'APPLE_WWDR_CERT',
        'APPLE_SIGNER_CERT',
        'APPLE_SIGNER_KEY',
        'APPLE_SIGNER_KEY_PASSPHRASE'
      ]
    });
  }

  try {
    const serialNumber = `${card.serialPrefix}-${Date.now()}`;
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: env.passTypeIdentifier,
      teamIdentifier: env.teamIdentifier,
      serialNumber,
      organizationName: card.organizationName,
      description: card.description,
      logoText: card.logoText,
      backgroundColor: card.backgroundColor,
      foregroundColor: card.foregroundColor,
      labelColor: card.labelColor,
      sharingProhibited: false,
      storeCard: {
        primaryFields: [{ key: 'name', label: 'AD', value: card.name }],
        secondaryFields: [
          { key: 'title', label: 'STATUS', value: card.title },
          { key: 'phone', label: 'TELEFON', value: card.phone }
        ],
        auxiliaryFields: [{ key: 'email', label: 'E-POÇT', value: card.email }],
        backFields: [
          { key: 'site', label: 'SAYT', value: card.url },
          { key: 'emailBack', label: 'E-POÇT', value: card.email },
          { key: 'phoneBack', label: 'TELEFON', value: card.phone }
        ]
      }
    };

    const pass = new PKPass({
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': iconPng,
      'icon@2x.png': iconPng,
      'logo.png': iconPng,
      'logo@2x.png': iconPng
    }, {
      wwdr: env.wwdr,
      signerCert: env.signerCert,
      signerKey: env.signerKey,
      signerKeyPassphrase: env.signerKeyPassphrase
    });

    pass.setBarcodes({
      message: card.url,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: card.url.replace(/^https?:\/\//, '')
    });

    const buffer = pass.getAsBuffer();
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${card.fileName}"`);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Wallet pass yaradıla bilmədi.' });
  }
};
