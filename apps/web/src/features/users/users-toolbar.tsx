import { useState } from "react";

import {
  pageSizeSchema,
  sortOrderSchema,
  userSortBySchema,
  type UsersQueryParams,
} from "@crud/contracts/users";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UsersToolbarProps = {
  params: UsersQueryParams;

  onParamsChange: (
    patch: Partial<UsersQueryParams>,
    options?: { replace?: boolean }
  ) => Promise<void>;
}

export function UsersToolbar({
  params,
  onParamsChange,
}: UsersToolbarProps) {
  const currentSearch = params.search ?? "";

  const [draft, setDraft] = useState({
    source: currentSearch,
    value: currentSearch,
  });

  // Sinkronkan draft saat URL berubah, termasuk back/forward.
  // Kondisi ini mencegah update berulang.
  if (draft.source !== currentSearch) {
    setDraft({
      source: currentSearch,
      value: currentSearch,
    });
  }

  const inputValue =
    draft.source === currentSearch
      ? draft.value
      : currentSearch;

  function submitSearch() {
    const value = inputValue.trim();

     // Tetap normalisasi input ketika pencarian tidak berubah.
    setDraft({
      source: currentSearch,
      value,
    });

    void onParamsChange({
      page: 1,
      search: value || undefined,
    })
  }

  function clearSearch() {
    setDraft({
      source: currentSearch,
      value: "",
    });

    void onParamsChange({
      page: 1,
      search: undefined,
    })
  }

  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-label="Filter daftar pengguna"
    >
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <Label htmlFor="users-search">
          Cari nama atau email
        </Label>

        <div className="flex flex-wrap gap-2">
          <Input
            id="users-search"
            className="min-w-48 flex-1"
            value={inputValue}
            maxLength={100}
            placeholder="Contoh: didin"
            onChange={(event) => {
              setDraft({
                source: currentSearch,
                value: event.target.value,
              });
            }}
          />

          <Button type="submit">
            Cari
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={
              inputValue.length === 0 &&
              currentSearch.length === 0
            }
            onClick={clearSearch}
          >
            Hapus pencarian
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label htmlFor="users-page-size">
            Jumlah per halaman
          </Label>

          <select
            id="users-page-size"
            className="h-9 rounded-md border bg-background px-3"
            value={params.pageSize}
            onChange={(event) => {
              const pageSize = pageSizeSchema.parse(
                Number(event.target.value),
              );

              void onParamsChange({
                page: 1,
                pageSize,
              });
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="users-sort-by">
            Urutkan berdasarkan
          </Label>

          <select
            id="users-sort-by"
            className="h-9 rounded-md border bg-background px-3"
            value={params.sortBy}
            onChange={(event) => {
              const sortBy = userSortBySchema.parse(
                event.target.value,
              );

              void onParamsChange({
                page: 1,
                sortBy,
              });
            }}
          >
            <option value="createdAt">
              Waktu dibuat
            </option>
            <option value="name">Nama</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="users-sort-order">
            Arah urutan
          </Label>

          <select
            id="users-sort-order"
            className="h-9 rounded-md border bg-background px-3"
            value={params.sortOrder}
            onChange={(event) => {
              const sortOrder = sortOrderSchema.parse(
                event.target.value,
              );

              void onParamsChange({
                page: 1,
                sortOrder,
              });
            }}
          >
            <option value="asc">Naik</option>
            <option value="desc">Turun</option>
          </select>
        </div>
      </div>
    </section>
  );
}
