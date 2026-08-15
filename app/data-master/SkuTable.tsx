import type { SkuItem } from '@/app/context/SkuContext';

export function SkuTable({ data, onEdit, onDelete }: { data: SkuItem[]; onEdit: (i: SkuItem) => void; onDelete: (id: string) => void }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['SKU','Nama','Grade','Kategori','Harga Beli','Harga Jual','Stok','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-50 bg-white">
          {data.map((item, i) => (
            <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
              <td className="px-3 py-2 font-mono text-xs text-brand-700">{item.sku}</td>
              <td className="px-3 py-2 font-medium text-slate-800">{item.nama}</td>
              <td className="px-3 py-2">{item.grade || '-'}</td>
              <td className="px-3 py-2 text-slate-600">{item.kategori || '-'}</td>
              <td className="px-3 py-2">Rp {item.hargaBaru.toLocaleString('id-ID')}</td>
              <td className="px-3 py-2 font-semibold text-brand-700">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
              <td className="px-3 py-2"><span className={`text-xs font-semibold ${item.stok < item.minStok ? 'text-red-500' : 'text-slate-700'}`}>{item.stok}{item.stok < item.minStok && ' ⚠'}</span></td>
              <td className="px-3 py-2"><div className="flex gap-1"><button onClick={() => onEdit(item)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={() => onDelete(item.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-400">Tidak ada SKU.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
