import { decodeHtml, formatDate } from '../utils/format.js';

export const CORE_COLLECTIONS = [
  {
    key: 'posts',
    label: 'Posts',
    description: 'Latest published posts (max 20 results).',
    endpoint:
      '/wp-json/wp/v2/posts?_fields=id,title,slug,status,date,link&per_page=20',
    columns: [
      {
        id: 'title',
        header: 'Title',
        accessorFn: (row) => decodeHtml(row?.title?.rendered ?? ''),
        cell: (info) => info.getValue()
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status'
      },
      {
        id: 'date',
        header: 'Published',
        accessorFn: (row) => formatDate(row?.date),
        cell: (info) => info.getValue()
      },
      {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug'
      },
      {
        id: 'link',
        header: 'Permalink',
        accessorKey: 'link'
      }
    ]
  },
  {
    key: 'pages',
    label: 'Pages',
    description: 'Latest published pages (max 20 results).',
    endpoint:
      '/wp-json/wp/v2/pages?_fields=id,title,slug,status,modified,link&per_page=20',
    columns: [
      {
        id: 'title',
        header: 'Title',
        accessorFn: (row) => decodeHtml(row?.title?.rendered ?? ''),
        cell: (info) => info.getValue()
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status'
      },
      {
        id: 'modified',
        header: 'Updated',
        accessorFn: (row) => formatDate(row?.modified),
        cell: (info) => info.getValue()
      },
      {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug'
      },
      {
        id: 'link',
        header: 'Permalink',
        accessorKey: 'link'
      }
    ]
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Top categories with usage counts (max 100 results).',
    endpoint:
      '/wp-json/wp/v2/categories?_fields=id,name,slug,count&per_page=100',
    columns: [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name'
      },
      {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug'
      },
      {
        id: 'count',
        header: 'Usage Count',
        accessorKey: 'count'
      }
    ]
  },
  {
    key: 'tags',
    label: 'Tags',
    description: 'Top tags with usage counts (max 100 results).',
    endpoint:
      '/wp-json/wp/v2/tags?_fields=id,name,slug,count&per_page=100',
    columns: [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name'
      },
      {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug'
      },
      {
        id: 'count',
        header: 'Usage Count',
        accessorKey: 'count'
      }
    ]
  },
  {
    key: 'media',
    label: 'Media',
    description: 'Recent media library items (max 20 results).',
    endpoint:
      '/wp-json/wp/v2/media?_fields=id,title,media_type,source_url,date&per_page=20',
    columns: [
      {
        id: 'title',
        header: 'Title',
        accessorFn: (row) => decodeHtml(row?.title?.rendered ?? ''),
        cell: (info) => info.getValue()
      },
      {
        id: 'media_type',
        header: 'Type',
        accessorKey: 'media_type'
      },
      {
        id: 'date',
        header: 'Uploaded',
        accessorFn: (row) => formatDate(row?.date),
        cell: (info) => info.getValue()
      },
      {
        id: 'source_url',
        header: 'Source URL',
        accessorKey: 'source_url'
      }
    ]
  }
];
