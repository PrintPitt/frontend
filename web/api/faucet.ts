// Vercel function: POST /api/faucet { address } → saldo awal MON. Env: FAUCET_PRIVATE_KEY, FAUCET_RPC_URL, FAUCET_AMOUNT_MON.
import { kirimSaldoAwal } from './_faucet';

export async function POST(request: Request): Promise<Response> {
  let body: { address?: unknown } = {};
  try {
    body = await request.json();
  } catch {}
  const hasil = await kirimSaldoAwal(body.address, process.env);
  return Response.json(hasil.body, { status: hasil.status });
}
