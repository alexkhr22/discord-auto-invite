require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildInvites,
    ],
  });

// ---- Discord Bot Setup ---- 
client.once("ready", () => {
    console.log(`✅ Ready! Logged in as ${client.user.tag} on ${client.guilds.cache.size} guild(s).`);
    client.user.setActivity({ name: "mit dem Code", type: "PLAYING" });
  
    // 🛠️ Debug-Ausgabe: Alle Guilds anzeigen
    client.guilds.cache.forEach(guild => {
      console.log(`🛠️ Bot ist in Guild: ${guild.name} (${guild.id})`);
    });
  });

client.login(process.env.DISCORD_BOT_TOKEN);

// ---- Express Setup für Stripe Webhooks ----
const app = express();
app.use(bodyParser.raw({ type: "application/json" }));

// Webhook Endpoint
app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // --- Kauf abgeschlossen ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
  
    // Hier direkt das Payment Link auslesen
    const paymentLinkId = session.payment_link;
    console.log("🪙 Payment Link ID:", paymentLinkId);
  
    // Kunden-Email auslesen
    const customerEmail = session.customer_email || session.customer_details?.email;
    if (!customerEmail) {
      console.error("⚠️ Keine Kunden-E-Mail im Stripe-Event gefunden!");
      return;
    }
  
    if (paymentLinkId === process.env.PAYMENT_LINK_GERMAN) {
      const inviteLink = await createInvite(process.env.GUILD_ID_GERMAN);
      await sendMailGerman(customerEmail, inviteLink);
    } else if (paymentLinkId === process.env.PAYMENT_LINK_ENGLISH) {
      const inviteLink = await createInvite(process.env.GUILD_ID_ENGLISH);
      await sendMailEnglish(customerEmail, inviteLink);
    }
  }

  res.json({ received: true });
});

// ---- Funktion: Discord Invite erstellen ----
async function createInvite(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`⚠️ Keine Guild mit ID ${guildId} gefunden!`);
  
    const channel = guild.channels.cache.find(ch => ch.isTextBased() && ch.viewable);
    if (!channel) throw new Error("⚠️ Kein Textkanal gefunden!");
  
    const invite = await guild.invites.create(channel.id, {
      maxUses: 1,
      maxAge: 86400,
      unique: true,
    });
  
    console.log("🔗 Invite erstellt:", invite.url);
    return invite.url;
}
  
// ---- Funktion: Mail auf Deutsch senden ----
async function sendMailGerman(to, inviteLink) {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // wichtig bei Port 587 (STARTTLS)
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SimpleAI - Discord Community" <noreply@simpleai-tools.de>`,
    to,
    subject: "Herzlich Willkommen in der Community 🎉",
    text: `Danke für dein Vertrauen in unsere Tools!\n\nHier ist dein persönlicher Discord-Einladungslink (gültig für 24 Stunden, nur einmal nutzbar):\n${inviteLink}\n\nZusätzlich kannst du jederzeit über dein persönliches Kundenportal deine Rechnungen einsehen und dein Abo verwalten:\nhttps://billing.stripe.com/p/login/6oU00i63rffo7ImcxBf7i00\n\nIch wünsche dir viel Spaß! Falls du Fragen oder Schwierigkeiten hast, kannst du Alex jederzeit auch privat auf Discord kontaktieren.\n\nFalls der Link nicht funktioniert, schreibe bitte eine private Mail an: alex.khr@yahoo.com\n\nLiebe Grüße\nGreta | SimpleAI`,
  });
  
  console.log("📧 Deutsche Mail verschickt an", to);  
}

// ---- Funktion: Mail auf Englisch senden ----
async function sendMailEnglish(to, inviteLink) {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SimpleAI - Discord Community" <noreply@simpleai-tools.de>`,
    to,
    subject: "Welcome to the Community 🎉",
    text: `Thank you for trusting our tools!\n\nHere is your personal Discord invite link (valid for 24 hours, single use only):\n${inviteLink}\n\nIn addition, you can access your personal Stripe customer portal here:\nhttps://billing.stripe.com/p/login/6oU00i63rffo7ImcxBf7i00\n\nIn the portal you can download invoices and manage your subscription at any time.\n\nI wish you lots of fun! If you have any questions or run into issues, feel free to reach out to Alex directly anytime.\n\nIf the link does not work, please send a private email at: alex.khr@yahoo.com\n\nBest regards,\nGreta | SimpleAI`,
  });
  
  console.log("📧 English Mail sent to", to);  
}

// ---- Server starten ----
app.listen(3000, () => console.log("🌐 Webhook Server läuft auf Port 3000"));