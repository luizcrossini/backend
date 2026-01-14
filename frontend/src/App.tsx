import { useState } from 'react';
import axios from 'axios';

type StreamEvent = {
  processId: string;
  index: number;
  total: number;
  cep: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  reason?: string;
  logradouro?: string;
  cidade?: string;
  uf?: string;
  cep_unico?: boolean;
};

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

const API_URL = import.meta.env.VITE_API_URL;
function App() {
  const [file, setFile] = useState<File | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  // 🔹 CONTADORES
  const [total, setTotal] = useState(0);
  const [success, setSuccess] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState(0);

  // 🔹 MODAL FINAL
  const [showModal, setShowModal] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert('Selecione um arquivo');
      return;
    }

    const processId = crypto.randomUUID();

    // RESET
    setEvents([]);
    setProgress(0);
    setLoading(true);
    setShowModal(false);
    setSuccess(0);
    setSkipped(0);
    setError(0);
    setTotal(0);

    // 🔴 STREAM SSE

    const es = new EventSource(
      `${API_URL}/cep/stream/${processId}`,
    );

    es.onmessage = (event) => {
      const data: StreamEvent = JSON.parse(event.data);

      setEvents((prev) => [...prev, data]);
      setTotal(data.total);
      setProgress(Math.round((data.index / data.total) * 100));

      if (data.status === 'SUCCESS') setSuccess((v) => v + 1);
      if (data.status === 'SKIPPED') setSkipped((v) => v + 1);
      if (data.status === 'ERROR') setError((v) => v + 1);

      // FINALIZA
      if (data.index === data.total) {
        es.close();
        setLoading(false);
        setTimeout(() => setShowModal(true), 300);
      }
    };

    // 🔵 UPLOAD
    const formData = new FormData();
    formData.append('file', file);

    await axios.post(
       `${API_URL}/cep/upload/${processId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Upload de CEPs</h1>

      <input
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <br /><br />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? `Processando... ${progress}%` : 'Processar'}
      </button>

      {/* 🔹 PROGRESS BAR */}
      <div
        style={{
          marginTop: 10,
          height: 10,
          background: '#eee',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#2563eb',
            transition: 'width 0.3s',
          }}
        />
      </div>

      {/* 🔹 TABELA */}
      <table style={{ marginTop: 20, width: '100%' }}>
        <thead>
          <tr>
            <th>CEP</th>
            <th>Status</th>
            <th>Logradouro</th>
            <th>Cidade</th>
            <th>UF</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td>{e.cep}</td>
              <td>{e.status}</td>
              <td>{e.logradouro ?? '—'}</td>
              <td>{e.cidade ?? '—'}</td>
              <td>{e.uf ?? '—'}</td>
              <td>{e.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔹 MODAL FINAL */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              width: 400,
            }}
          >
            <h2>Resumo do processamento</h2>

            <p>📄 Total na planilha: <b>{total}</b> (100%)</p>
            <p>✅ Processados: <b>{success} ({percent(success, total)}%)</b></p>
            <p>⏭️ Já no banco: <b>{skipped} ({percent(skipped, total)}%)</b></p>
            <p>❌ Erros: <b>{error} ({percent(error, total)}%)</b></p>

            <button
              style={{ marginTop: 16 }}
              onClick={() => setShowModal(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
