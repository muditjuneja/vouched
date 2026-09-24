import { renderPage } from "../Layout";
import { ApiKeysSection, NewKeyButton } from "../components/ApiKeysSection";
import type { ApiKeysData } from "../types";

function ApiKeysPage({ data }: { data: ApiKeysData }) {
  return (
    <>
      <div class="page-header-row">
        <h1>API keys</h1>
        <NewKeyButton />
      </div>
      <ApiKeysSection apiKeys={data.apiKeys} openCreate={data.openCreate} />
    </>
  );
}

export function renderApiKeys(data: ApiKeysData): string {
  return renderPage({
    title: "API keys",
    activePath: "/dashboard/api-keys",
    user: data.user,
    notice: data.notice,
    children: <ApiKeysPage data={data} />
  });
}
