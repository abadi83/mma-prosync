import { getSupplier, createSupplier, updateSupplier, deleteSupplier } from '@/app/services/supplierService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export async function GET() { try { return apiSuccess(await getSupplier()); } catch { return apiServerError('GET /api/supplier'); } }
export async function POST(r: Request) { try { const {nama,kontak,produk}=await r.json(); const e=validateRequired({nama}); if(e) return apiBadRequest(e); return apiCreated(await createSupplier(nama,kontak,produk)); } catch { return apiServerError('POST /api/supplier'); } }
export async function PUT(r: Request) { try { const {id,nama,kontak,produk}=await r.json(); const e=validateRequired({id,nama}); if(e) return apiBadRequest(e); const i=await updateSupplier(id,nama,kontak,produk); if(!i) return apiNotFound(); return apiSuccess(i); } catch { return apiServerError('PUT /api/supplier'); } }
export async function DELETE(r: Request) { try { const id=new URL(r.url).searchParams.get('id'); if(!id) return apiBadRequest('id wajib'); const ok=await deleteSupplier(id); if(!ok) return apiNotFound(); return apiSuccess({deleted:true}); } catch { return apiServerError('DELETE /api/supplier'); } }
