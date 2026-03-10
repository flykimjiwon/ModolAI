import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

// Update chat room information
export async function PATCH(request, { params }) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please enter a chat room name.' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: 'Chat room name must be 50 characters or fewer.' },
        { status: 400 }
      );
    }

    // Look up user ID (email-based)
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [payload.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Fetch chat room and verify owner
    const roomResult = await query(
      `SELECT cr.id, cr.user_id, cr.name, u.email 
       FROM chat_rooms cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [id]
    );

    // If chat room does not exist
    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Chat room not found.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Verify chat room owner (email-based)
    if (room.email !== payload.email) {
      return NextResponse.json(
        {
          error: 'Unauthorized to access this chat room.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // Update chat room name
    const updateResult = await query(
      `UPDATE chat_rooms 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [name.trim(), id, userId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update chat room.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chat room name updated.',
    });
  } catch (error) {
    console.error('Failed to update chat room:', error);
    return NextResponse.json(
      { error: 'Failed to update chat room', details: error.message },
      { status: 500 }
    );
  }
}

// Delete chat room
export async function DELETE(request, { params }) {
  let id = 'unknown';
  let payload = null;

  try {
    payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const paramsData = await params;
    id = paramsData.id;

    console.log('DELETE request - Room ID:', id, 'User ID:', payload.sub);

    // Check ID and validate UUID
    if (!id) {
      console.error('ID is empty');
      return NextResponse.json(
        { error: 'Room ID is required.' },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      console.error('Invalid UUID format:', id);
      return NextResponse.json(
        { error: `Invalid room ID format: ${id}` },
        { status: 400 }
      );
    }

    // Look up user ID (email-based)
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [payload.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Fetch chat room and verify owner
    const roomResult = await query(
      `SELECT cr.id, cr.user_id, cr.name, u.email 
       FROM chat_rooms cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [id]
    );

    console.log('Found room:', roomResult.rows.length > 0 ? 'exists' : 'not found');

    // If chat room does not exist
    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Chat room not found.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Verify chat room owner (email-based)
    if (room.email !== payload.email) {
      return NextResponse.json(
        {
          error: 'Unauthorized to access this chat room.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // Sequential deletion via PostgreSQL transaction
    try {
      console.log('Starting chat room deletion:', id);

      // Delete chat history (auto-deleted by CASCADE, but explicitly deleting)
      const historyDeleteResult = await query(
        'DELETE FROM chat_history WHERE room_id = $1',
        [id]
      );
      console.log(
        'Chat history deletion completed:',
        historyDeleteResult.rowCount,
        'items'
      );

      // 3. Delete chat room
      console.log('Starting chat room deletion:', id);
      const roomDeleteResult = await query(
        'DELETE FROM chat_rooms WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      console.log('Chat room deletion completed:', roomDeleteResult.rowCount, 'items');

      if (roomDeleteResult.rowCount === 0) {
        console.warn('Chat room was not deleted - already removed or no permission');
      }
    } catch (transactionError) {
      console.error('Error during deletion process:', transactionError);
      throw transactionError;
    }

    return NextResponse.json({
      success: true,
      message: 'Chat room deleted.',
    });
  } catch (error) {
    console.error('Failed to delete chat room:', {
      error: error.message,
      stack: error.stack,
      roomId: id,
      userId: payload?.sub || 'unknown',
      type: error.constructor.name,
    });

    // Handle specific error types
    if (error.message.includes('UUID') || error.message.includes('invalid input syntax')) {
      return NextResponse.json(
        { error: 'Invalid room ID format.' },
        { status: 400 }
      );
    }

    if (
      error.message.includes('Authentication') ||
      error.message.includes('authorization')
    ) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    if (
      error.message.includes('PostgreSQL') ||
      error.message.includes('Connection') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: 'An error occurred while deleting the chat room.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
