// Deploy + seed FotokopiKilat ke anvil lokal untuk dev frontend (bukan untuk testnet).
// Pakai: jalankan `anvil --block-time 1` (anvil BARU, nonce deployer 0), lalu dari folder web/: `node scripts/seed-anvil.mjs`
// Contract jatuh di alamat yang sama dengan shared/src/fotokopiKilat.generated.ts (nonce 1 akun #0).
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const MN = 'test test test test test test test test test test test junk'; // mnemonic publik anvil
const ART = new URL('../../contracts/out/FotokopiKilat.sol/FotokopiKilat.json', import.meta.url);
const { abi, bytecode } = JSON.parse(fs.readFileSync(ART, 'utf8'));

const pub = createPublicClient({ chain: anvil, transport: http(RPC), pollingInterval: 100 });
const acc = (i) => mnemonicToAccount(MN, { addressIndex: i });
const op = createWalletClient({ chain: anvil, account: acc(0), transport: http(RPC), pollingInterval: 100 });
const tunggu = (hash) => pub.waitForTransactionReceipt({ hash });

if ((await pub.getTransactionCount({ address: acc(0).address })) !== 0) throw new Error('Nonce deployer bukan 0: restart anvil dulu');
await tunggu(await op.sendTransaction({ to: acc(0).address, value: 0n })); // habiskan nonce 0
const { contractAddress: C } = await tunggu(await op.deployContract({ abi, bytecode: bytecode.object, args: ['Fotokopi Kilat', 'FKK', 45] }));
const tulis = async (functionName, args) => tunggu(await op.writeContract({ address: C, abi, functionName, args }));

// Katalog sesuai Desain Contract bagian 14
await tulis('setKatalog', [1, 10n ** 16n, 30, [1], 'Fotokopi KTP']);
await tulis('setKatalog', [2, 10n ** 16n, 30, [2], 'Boarding Pass']);
await tulis('setKatalog', [3, 2n * 10n ** 16n, 45, [1, 3], 'Laminating Ijazah']);
await tulis('setKatalog', [4, 2n * 10n ** 16n, 45, [2, 3], 'Menu Warung']);
await tulis('registerShop', [acc(1).address, 'Toko A']);
await tulis('registerShop', [acc(2).address, 'Toko B']);
await tulis('startSession', []);
console.log(`OK: contract ${C}, katalog 4 jenis, Toko A = akun #1 (/toko?dev=1), Toko B = akun #2 (/toko?dev=2), sesi dibuka`);
