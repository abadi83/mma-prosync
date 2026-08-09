# MMA ProSync — Deploy ke Hostinger VPS

## 1. Siapkan VPS (sekali saja)

```bash
# SSH ke VPS
ssh root@IP_VPS_ANDA

# Update sistem
apt update && apt upgrade -y

# Install Node.js 20 + npm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager biar app tetap hidup)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Git
apt install -y git
```

## 2. Upload project ke VPS

### Opsi A: Via Git (rekomendasi)
```bash
# Di laptop/local — push ke GitHub dulu
git init
git add .
git commit -m "Production ready"
git remote add origin https://github.com/USERNAME/mma-prosync.git
git push -u origin main

# Di VPS — clone
cd /home
git clone https://github.com/USERNAME/mma-prosync.git
cd mma-prosync
```

### Opsi B: Via SCP (upload langsung)
```bash
# Di laptop/local — zip & kirim
# PowerShell:
Compress-Archive -Path * -DestinationPath mma-prosync.zip
scp mma-prosync.zip root@IP_VPS:/home/

# Di VPS
cd /home
unzip mma-prosync.zip -d mma-prosync
cd mma-prosync
```

## 3. Install & Build

```bash
cd /home/mma-prosync

# Hapus build lokal Windows (jika ada)
rm -rf .next

# Install dependencies (termasuk devDependencies untuk build)
npm ci

# Build production
npm run build

# Buat folder logs
mkdir -p logs
```

## 4. Jalankan dengan PM2

```bash
# Pastikan cwd di ecosystem.config.js sudah sesuai path project di VPS
# Default: /home/mulus/mma-prosync — ubah jika perlu

pm2 start ecosystem.config.js
pm2 save
pm2 startup  # auto-start saat VPS reboot
```

## 5. Setup Nginx Reverse Proxy

```bash
nano /etc/nginx/sites-available/mma-prosync
```

Isi dengan:
```nginx
server {
    listen 80;
    server_name IP_VPS_ANDA;  # atau domain kamu

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Aktifkan
ln -s /etc/nginx/sites-available/mma-prosync /etc/nginx/sites-enabled/
nginx -t          # test config
systemctl reload nginx
```

## 6. Selesai!

Buka browser: `http://IP_VPS_ANDA`

### Perintah berguna:
```bash
pm2 status              # lihat status app
pm2 logs mma-prosync    # lihat log
pm2 restart mma-prosync # restart
pm2 stop mma-prosync    # stop
npm run build && pm2 restart mma-prosync  # update setelah git pull
```

## Catatan Penting:
- ⚠️ Tidak ada database — semua data disimpan di `localStorage` browser client
- 🔄 Data client-side tidak dishare antar user/browser
- 🛡️ Untuk production sebaiknya tambahkan database (Supabase/PostgreSQL)
- 🔒 Tambahkan SSL dengan Certbot: `apt install certbot python3-certbot-nginx && certbot --nginx`
- 🐛 Jika muncul "Application error: a client-side exception", biasanya karena build Windows di-upload ke VPS. Pastikan selalu `rm -rf .next` dan build ulang di VPS.
