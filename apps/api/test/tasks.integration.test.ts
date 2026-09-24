import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module';

test('tasks enforce workspace roles, board lineage, membership, rank and versions', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const keyServer = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        keys: [{ ...jwk, kid: 'task-key', alg: 'ES256', use: 'sig' }],
      }),
    );
  });
  keyServer.listen(0, '127.0.0.1');
  await once(keyServer, 'listening');
  const keyAddress = keyServer.address();
  assert.ok(keyAddress && typeof keyAddress !== 'string');
  const projectUrl = `http://127.0.0.1:${keyAddress.port}`;
  const oldUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = projectUrl;
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const prisma = new PrismaClient();
  const subjects = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  let workspaceId: string | undefined;

  async function token(subject: string, email: string) {
    return new SignJWT({ email, role: 'authenticated', is_anonymous: false })
      .setProtectedHeader({ alg: 'ES256', kid: 'task-key' })
      .setSubject(subject)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('10m')
      .sign(privateKey);
  }
  async function send(
    path: string,
    bearer: string,
    method = 'GET',
    body?: object,
  ) {
    return fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  try {
    const owner = await token(subjects[0], 'task-owner@example.test');
    const editor = await token(subjects[1], 'task-editor@example.test');
    const viewer = await token(subjects[2], 'task-viewer@example.test');
    const outsider = await token(subjects[3], 'task-outsider@example.test');
    const created = await send('/workspaces', owner, 'POST', {
      name: 'Task test',
    });
    assert.equal(created.status, 201);
    workspaceId = ((await created.json()) as { id: string }).id;
    for (const [email, role, bearer] of [
      ['task-editor@example.test', 'EDITOR', editor],
      ['task-viewer@example.test', 'VIEWER', viewer],
    ] as const) {
      const invited = await send(
        `/workspaces/${workspaceId}/invitations`,
        owner,
        'POST',
        { email, role },
      );
      assert.equal(invited.status, 201);
      const invitation = (await invited.json()) as { token: string };
      assert.equal(
        (
          await send('/invitations/accept', bearer, 'POST', {
            token: invitation.token,
          })
        ).status,
        201,
      );
    }
    const projectResponse = await send(
      `/workspaces/${workspaceId}/projects`,
      owner,
      'POST',
      { name: 'Task project' },
    );
    assert.equal(projectResponse.status, 201);
    const project = (await projectResponse.json()) as {
      id: string;
      boards: Array<{ id: string; columns: Array<{ id: string }> }>;
    };
    const board = project.boards[0];
    const [todo, inProgress] = board.columns;
    assert.equal(
      (
        await send(`/boards/${board.id}/tasks`, viewer, 'POST', {
          title: 'Denied',
          columnId: todo.id,
        })
      ).status,
      403,
    );
    assert.equal(
      (await send(`/boards/${board.id}/tasks`, outsider)).status,
      404,
    );
    const taskResponse = await send(
      `/boards/${board.id}/tasks`,
      editor,
      'POST',
      { title: 'Prepare release', columnId: todo.id },
    );
    assert.equal(taskResponse.status, 201);
    const task = (await taskResponse.json()) as {
      id: string;
      version: number;
      rank: string;
      columnId: string;
    };
    assert.equal(task.version, 1);
    assert.equal(task.rank.length, 18);
    assert.equal((await send(`/tasks/${task.id}`, viewer)).status, 200);
    assert.equal((await send(`/tasks/${task.id}`, outsider)).status, 404);
    assert.equal(
      (
        await send(`/tasks/${task.id}`, viewer, 'PATCH', {
          title: 'Denied',
          expectedVersion: 1,
        })
      ).status,
      403,
    );
    const updated = await send(`/tasks/${task.id}`, editor, 'PATCH', {
      title: 'Prepare rollout',
      priority: 'HIGH',
      expectedVersion: 1,
    });
    assert.equal(updated.status, 200);
    assert.equal(((await updated.json()) as { version: number }).version, 2);
    assert.equal(
      (
        await send(`/tasks/${task.id}`, editor, 'PATCH', {
          title: 'Stale',
          expectedVersion: 1,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send(`/tasks/${task.id}/move`, editor, 'POST', {
          toColumnId: randomUUID(),
          expectedVersion: 2,
        })
      ).status,
      400,
    );
    const moved = await send(`/tasks/${task.id}/move`, editor, 'POST', {
      toColumnId: inProgress.id,
      expectedVersion: 2,
    });
    assert.equal(moved.status, 201);
    const movedTask = (await moved.json()) as {
      version: number;
      columnId: string;
    };
    assert.equal(movedTask.version, 3);
    assert.equal(movedTask.columnId, inProgress.id);
    assert.equal(
      (
        await send(`/tasks/${task.id}/move`, editor, 'POST', {
          toColumnId: todo.id,
          expectedVersion: 2,
        })
      ).status,
      409,
    );
    const secondResponse = await send(
      `/boards/${board.id}/tasks`,
      editor,
      'POST',
      { title: 'Second', columnId: todo.id },
    );
    const thirdResponse = await send(
      `/boards/${board.id}/tasks`,
      editor,
      'POST',
      { title: 'Third', columnId: todo.id },
    );
    assert.equal(secondResponse.status, 201);
    assert.equal(thirdResponse.status, 201);
    const secondId = ((await secondResponse.json()) as { id: string }).id;
    const thirdId = ((await thirdResponse.json()) as { id: string }).id;
    const completed = await send(`/tasks/${secondId}`, editor, 'PATCH', {
      completed: true,
      expectedVersion: 1,
    });
    assert.equal(completed.status, 200);
    const completedAt = ((await completed.json()) as { completedAt: string })
      .completedAt;
    const editedCompleted = await send(`/tasks/${secondId}`, editor, 'PATCH', {
      title: 'Second updated',
      completed: true,
      expectedVersion: 2,
    });
    assert.equal(editedCompleted.status, 200);
    assert.equal(
      ((await editedCompleted.json()) as { completedAt: string }).completedAt,
      completedAt,
    );
    assert.equal(
      (
        await send(`/tasks/${thirdId}/move`, editor, 'POST', {
          toColumnId: todo.id,
          beforeTaskId: secondId,
          expectedVersion: 1,
        })
      ).status,
      201,
    );
    const orderedList = await send(`/boards/${board.id}/tasks`, editor);
    assert.equal(orderedList.status, 200);
    const orderedItems = (
      (await orderedList.json()) as {
        items: Array<{ id: string; columnId: string }>;
      }
    ).items;
    assert.deepEqual(
      orderedItems
        .filter((item) => item.columnId === todo.id)
        .map((item) => item.id),
      [thirdId, secondId],
    );
    const afterFirst = await send(
      `/boards/${board.id}/tasks?cursor=${thirdId}`,
      editor,
    );
    assert.equal(afterFirst.status, 200);
    assert.deepEqual(
      ((await afterFirst.json()) as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
      [secondId, task.id],
    );
    const outsiderProfile = await send('/users/me', outsider);
    assert.equal(outsiderProfile.status, 200);
    const outsiderId = ((await outsiderProfile.json()) as { id: string }).id;
    assert.equal(
      (
        await send(`/tasks/${task.id}/assignees`, editor, 'PUT', {
          userIds: [outsiderId],
          expectedVersion: 3,
        })
      ).status,
      400,
    );
    const membersResponse = await send(
      `/workspaces/${workspaceId}/members`,
      owner,
    );
    const members = (await membersResponse.json()) as Array<{
      id: string;
      user: { id: string; email: string };
    }>;
    const editorId = members.find(
      (member) => member.user.email === 'task-editor@example.test',
    )?.user.id;
    assert.ok(editorId);
    const assigned = await send(`/tasks/${task.id}/assignees`, editor, 'PUT', {
      userIds: [editorId],
      expectedVersion: 3,
    });
    assert.equal(assigned.status, 200);
    assert.equal(
      ((await assigned.json()) as { assignees: unknown[]; version: number })
        .assignees.length,
      1,
    );
    const labelResponse = await send(
      `/projects/${project.id}/labels`,
      editor,
      'POST',
      { name: 'Launch', color: '#8e83f2' },
    );
    assert.equal(labelResponse.status, 201);
    const labelId = ((await labelResponse.json()) as { id: string }).id;
    const labeled = await send(`/tasks/${task.id}/labels`, editor, 'PUT', {
      labelIds: [labelId],
      expectedVersion: 4,
    });
    assert.equal(labeled.status, 200);
    assert.equal(
      ((await labeled.json()) as { labels: unknown[] }).labels.length,
      1,
    );
    assert.equal(
      (await send(`/tasks/${task.id}/copy`, viewer, 'POST')).status,
      403,
    );
    const copied = await send(`/tasks/${task.id}/copy`, editor, 'POST');
    assert.equal(copied.status, 201);
    const copiedTask = (await copied.json()) as {
      id: string;
      version: number;
      assignees: unknown[];
      labels: unknown[];
    };
    assert.equal(copiedTask.version, 1);
    assert.equal(copiedTask.assignees.length, 1);
    assert.equal(copiedTask.labels.length, 1);
    assert.equal(
      (
        await send(`/tasks/${copiedTask.id}/permanent`, editor, 'DELETE', {
          expectedVersion: 1,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send(`/tasks/${copiedTask.id}/permanent`, owner, 'DELETE', {
          expectedVersion: 1,
        })
      ).status,
      200,
    );
    assert.equal((await send(`/tasks/${copiedTask.id}`, owner)).status, 404);
    assert.equal(
      (
        await send(
          `/boards/${board.id}/columns/${inProgress.id}`,
          owner,
          'DELETE',
          { expectedVersion: 1 },
        )
      ).status,
      409,
    );
    const archived = await send(`/tasks/${task.id}`, editor, 'DELETE', {
      expectedVersion: 5,
    });
    assert.equal(archived.status, 200);
    assert.equal((await send(`/tasks/${task.id}`, editor)).status, 404);
    const list = await send(`/boards/${board.id}/tasks`, editor);
    assert.equal(list.status, 200);
    assert.equal(((await list.json()) as { items: unknown[] }).items.length, 2);
    const raceCreated = await send(`/boards/${board.id}/tasks`, owner, 'POST', {
      title: 'Concurrent move',
      columnId: todo.id,
    });
    assert.equal(raceCreated.status, 201);
    const raceTask = (await raceCreated.json()) as {
      id: string;
      version: number;
    };
    const [firstMove, secondMove] = await Promise.all([
      send(`/tasks/${raceTask.id}/move`, owner, 'POST', {
        toColumnId: inProgress.id,
        expectedVersion: raceTask.version,
      }),
      send(`/tasks/${raceTask.id}/move`, editor, 'POST', {
        toColumnId: board.columns[2].id,
        expectedVersion: raceTask.version,
      }),
    ]);
    assert.deepEqual([firstMove.status, secondMove.status].sort(), [201, 409]);
    const winner = firstMove.status === 201 ? firstMove : secondMove;
    const winningTask = (await winner.json()) as {
      columnId: string;
      version: number;
    };
    const canonicalTask = (await (
      await send(`/tasks/${raceTask.id}`, owner)
    ).json()) as { columnId: string; version: number };
    assert.equal(canonicalTask.columnId, winningTask.columnId);
    assert.equal(canonicalTask.version, 2);
    assert.equal(
      (
        await send(`/tasks/${raceTask.id}`, owner, 'DELETE', {
          expectedVersion: 2,
        })
      ).status,
      200,
    );
    const editorMemberId = members.find(
      (member) => member.user.id === editorId,
    )?.id;
    assert.ok(editorMemberId);
    assert.equal(
      (
        await send(
          `/workspaces/${workspaceId}/members/${editorMemberId}`,
          owner,
          'DELETE',
        )
      ).status,
      200,
    );
    assert.equal(
      await prisma.taskAssignee.count({
        where: { taskId: task.id, userId: editorId },
      }),
      0,
    );
  } finally {
    if (workspaceId)
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { authSubject: { in: subjects } } });
    await prisma.$disconnect();
    await app.close();
    keyServer.close();
    process.env.SUPABASE_URL = oldUrl;
  }
});
