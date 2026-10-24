// Bot order untuk anvil lokal (contract v2: bayar tIDRX). Alternatif: jalankan backend PrintPitt lokal dengan BOT=on. Minter (akun #6) mencetak tIDRX untuk bot (akun #4),
// bot approve contract, lalu createOrder acak tiap INTERVAL_MS. Khusus dev; di testnet bot ada di backend Railway.
//   node scripts/bot-anvil.mjs            (env opsional: INTERVAL_MS=6000, MAX_ORDERS=0, RPC_URL)
import { createPublicClient, createWalletClient, http, maxUint256 } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import { deploymentUntuk, fotokopiKilatAbi, formatRupiah, NOL32, tidrxAbi } from '../../shared/src/index.ts';

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 6000);
const MAX_ORDERS = Number(process.env.MAX_ORDERS ?? 0);
const MN = 'test test test test test test test test test test test junk'; // mnemonic publik anvil
const d = deploymentUntuk(31337);
const pub = createPublicClient({ chain: anvil, transport: http(RPC), pollingInterval: 200 });
const dompet = (i) => createWalletClient({ chain: anvil, account: mnemonicToAccount(MN, { addressIndex: i }), transport: http(RPC), pollingInterval: 200 });
const minter = dompet(6);
const bot = dompet(4);
const tunggu = (hash) => pub.waitForTransactionReceipt({ hash });

const TEKS = {
  1: ['KTP Budi bolak-balik 10x', 'KTP buat daftar CPNS', 'KTP + KK sekalian Mas'],
  2: ['Boarding JOG-CGK 05.40', 'Tiket kereta Taksaka', 'Boarding pass, pesawat 20 menit lagi'],
  3: ['Ijazah S1 Teknik Informatika', 'Ijazah SMA buat lamaran', 'Sertifikat lomba 17-an'],
  4: ['Menu Warung Bu Sri', 'Menu Angkringan Lik Man', 'Menu Kopi Klotok'],
};
const acak = (xs) => xs[Math.floor(Math.random() * xs.length)];

await tunggu(await minter.writeContract({ address: d.tidrx, abi: tidrxAbi, functionName: 'mint', args: [bot.account.address, 100_000_000n] }));
await tunggu(await bot.writeContract({ address: d.tidrx, abi: tidrxAbi, functionName: 'approve', args: [d.address, maxUint256] }));
console.log(`bot ${bot.account.address} siap: saldo ${formatRupiah(await pub.readContract({ address: d.tidrx, abi: tidrxAbi, functionName: 'balanceOf', args: [bot.account.address] }))}`);

for (let n = 1; MAX_ORDERS === 0 || n <= MAX_ORDERS; n++) {
  try {
    const jenis = acak([1, 2, 3, 4]);
    const teks = acak(TEKS[jenis]);
    const r = await tunggu(await bot.writeContract({ address: d.address, abi: fotokopiKilatAbi, functionName: 'createOrder', args: [jenis, teks, 1, NOL32, NOL32] })); // v2 mode demo: 1 halaman, tanpa dokumen/kode
    console.log(`#${n} jenis ${jenis} "${teks}" → ${r.status}`);
  } catch (e) {
    console.log('gagal:', e.shortMessage ?? e.message);
  }
  await new Promise((res) => setTimeout(res, INTERVAL_MS));
}
