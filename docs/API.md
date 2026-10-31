# API Documentation

## Overview

The MOAZ ALIAN API is a RESTful API served by the backend at `http://localhost:3000` (development) or your production URL.

## Base URL

```
Development:  http://localhost:3000/api
Production:   https://api.moaz-alian.com/api
```

## Authentication

All endpoints require authentication via JWT token. Include in header:

```
Authorization: Bearer <your_jwt_token>
```

### Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

## Knowledge Library

### List Library Items

```
GET /api/library
```

Query Parameters:
- `category` - Filter by category
- `type` - Filter by type (video, book, article, research)
- `search` - Search by title/description
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

Example:
```bash
curl http://localhost:3000/api/library?category=technology&type=video \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Learning TypeScript",
      "description": "...",
      "category": "technology",
      "type": "video",
      "url": "https://...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### Get Single Item

```
GET /api/library/:id
```

Example:
```bash
curl http://localhost:3000/api/library/abc-123 \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "id": "abc-123",
  "title": "Learning TypeScript",
  "description": "...",
  "category": "technology",
  "type": "video",
  "url": "https://...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Create Item

```
POST /api/library
```

Body:
```json
{
  "title": "New Item",
  "description": "Item description",
  "category": "technology",
  "type": "video",
  "url": "https://example.com/item"
}
```

Example:
```bash
curl -X POST http://localhost:3000/api/library \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learning React",
    "description": "Beginner friendly React tutorial",
    "category": "web development",
    "type": "video",
    "url": "https://example.com/react"
  }'
```

Response: (201 Created)
```json
{
  "id": "new-uuid",
  "title": "Learning React",
  "description": "Beginner friendly React tutorial",
  "category": "web development",
  "type": "video",
  "url": "https://example.com/react",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Update Item

```
PUT /api/library/:id
```

Body: (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

### Delete Item

```
DELETE /api/library/:id
```

Response: (204 No Content)

---

## Chat

### List Conversations

```
GET /api/chats
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

Response:
```json
{
  "threads": [
    {
      "id": "uuid",
      "title": "Conversation Title",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 5,
  "page": 1
}
```

### Create Conversation

```
POST /api/chats
```

Body:
```json
{
  "title": "New Conversation"
}
```

Response: (201 Created)
```json
{
  "id": "new-uuid",
  "title": "New Conversation",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Get Conversation Messages

```
GET /api/chats/:threadId/messages
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Messages per page (default: 50)

Response:
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is React?",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "React is a JavaScript library...",
      "createdAt": "2024-01-01T00:00:05Z"
    }
  ],
  "total": 2,
  "page": 1
}
```

### Send Message

```
POST /api/chats/:threadId/messages
```

Body:
```json
{
  "content": "Your message here"
}
```

Response: (201 Created)
```json
{
  "id": "new-uuid",
  "role": "user",
  "content": "Your message here",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## User Profile

### Get Current User

```
GET /api/users/profile
```

Response:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Update Profile

```
PUT /api/users/profile
```

Body:
```json
{
  "name": "New Name",
  "bio": "User bio"
}
```

Response:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "New Name",
  "bio": "User bio",
  "role": "user"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Example Error

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

## Rate Limiting

Rate limits:
- **Authenticated**: 100 requests per minute
- **Unauthenticated**: 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Pagination

List endpoints support pagination:

Query Parameters:
- `page` - Page number (1-indexed, default: 1)
- `limit` - Items per page (default: 20, max: 100)

Response:
```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 500,
  "pages": 25
}
```

---

## Webhooks (Future)

Webhooks for events:
- `library.item.created`
- `library.item.updated`
- `chat.message.created`
- `user.created`

See documentation updates for webhook setup.

---

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq '.token'
```

### List Library
```bash
TOKEN="your_token_here"
curl http://localhost:3000/api/library \
  -H "Authorization: Bearer $TOKEN"
```

---

## SDK & Client Libraries

- **JavaScript/TypeScript**: Use `fetch` API or libraries like `axios`
- **React**: Use TanStack Query for data fetching
- **Mobile**: Fetch API in React Native

Example with React Query:
```typescript
import { useQuery } from '@tanstack/react-query';

function useLibrary() {
  return useQuery({
    queryKey: ['library'],
    queryFn: async () => {
      const response = await fetch('/api/library', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      return response.json();
    }
  });
}
```

---

## Support

- Issues: [GitHub Issues](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues)
- Discussions: [GitHub Discussions](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/discussions)

