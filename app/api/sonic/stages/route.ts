import { NextRequest, NextResponse } from "next/server";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type StageRow = RowDataPacket & {
  stage_id: number;
  stage_name: string;
  color_hex: string;
  actions: string | null;
  created_at: string;
  updated_at: string;
};

function getDbConfig() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error("Missing database environment variables.");
  }

  return {
    host,
    user,
    password,
    database,
  };
}

function isValidHexColor(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function normalizeActions(actions: unknown): string | null {
  if (actions === undefined || actions === null) {
    return null;
  }

  if (!Array.isArray(actions)) {
    throw new Error("Actions must be an array.");
  }

  return JSON.stringify(actions);
}

// GET /api/sonic/stages
export async function GET() {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<StageRow[]>(
      `
      SELECT
        stage_id,
        stage_name,
        color_hex,
        actions,
        created_at,
        updated_at
      FROM stages
      ORDER BY stage_id ASC
      `
    );

    const stages = rows.map((row) => ({
      ...row,
      actions:
        typeof row.actions === "string" && row.actions
          ? JSON.parse(row.actions)
          : [],
    }));

    return NextResponse.json({
      success: true,
      stages,
    });
  } catch (error) {
    console.error("Failed to load stages:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load stages.",
        stages: [],
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// POST /api/sonic/stages
export async function POST(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const stageName = String(body.stage_name ?? body.stageName ?? "").trim();
    const colorHex = String(body.color_hex ?? body.colorHex ?? "#FFFFFF").trim();
    const actions = normalizeActions(body.actions ?? []);

    if (!stageName) {
      return NextResponse.json(
        {
          success: false,
          error: "Stage name is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidHexColor(colorHex)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid color_hex. Use format #RRGGBB.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO stages (
        stage_name,
        color_hex,
        actions
      )
      VALUES (?, ?, ?)
      `,
      [stageName, colorHex, actions]
    );

    const [createdRows] = await connection.execute<StageRow[]>(
      `
      SELECT
        stage_id,
        stage_name,
        color_hex,
        actions,
        created_at,
        updated_at
      FROM stages
      WHERE stage_id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    const createdStage = createdRows[0]
      ? {
          ...createdRows[0],
          actions:
            typeof createdRows[0].actions === "string" && createdRows[0].actions
              ? JSON.parse(createdRows[0].actions)
              : [],
        }
      : null;

    return NextResponse.json({
      success: true,
      stage: createdStage,
    });
  } catch (error: any) {
    console.error("Failed to create stage:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create stage.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// PATCH /api/sonic/stages
export async function PATCH(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const stageId = Number(body.stage_id ?? body.stageId);

    const stageName =
      body.stage_name !== undefined || body.stageName !== undefined
        ? String(body.stage_name ?? body.stageName ?? "").trim()
        : null;

    const colorHex =
      body.color_hex !== undefined || body.colorHex !== undefined
        ? String(body.color_hex ?? body.colorHex ?? "").trim()
        : null;

    const actions =
      body.actions !== undefined ? normalizeActions(body.actions) : undefined;

    if (!Number.isInteger(stageId) || stageId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid stage_id.",
        },
        { status: 400 }
      );
    }

    if (stageName !== null && !stageName) {
      return NextResponse.json(
        {
          success: false,
          error: "Stage name cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (colorHex !== null && !isValidHexColor(colorHex)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid color_hex. Use format #RRGGBB.",
        },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (stageName !== null) {
      updates.push("stage_name = ?");
      values.push(stageName);
    }

    if (colorHex !== null) {
      updates.push("color_hex = ?");
      values.push(colorHex);
    }

    if (actions !== undefined) {
      updates.push("actions = ?");
      values.push(actions);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No fields were provided to update.",
        },
        { status: 400 }
      );
    }

    values.push(stageId);

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE stages
      SET ${updates.join(", ")}
      WHERE stage_id = ?
      `,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Stage not found.",
        },
        { status: 404 }
      );
    }

    const [updatedRows] = await connection.execute<StageRow[]>(
      `
      SELECT
        stage_id,
        stage_name,
        color_hex,
        actions,
        created_at,
        updated_at
      FROM stages
      WHERE stage_id = ?
      LIMIT 1
      `,
      [stageId]
    );

    const updatedStage = updatedRows[0]
      ? {
          ...updatedRows[0],
          actions:
            typeof updatedRows[0].actions === "string" && updatedRows[0].actions
              ? JSON.parse(updatedRows[0].actions)
              : [],
        }
      : null;

    return NextResponse.json({
      success: true,
      stage: updatedStage,
    });
  } catch (error: any) {
    console.error("Failed to update stage:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update stage.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// DELETE /api/sonic/stages?stageId=1
export async function DELETE(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);

    const stageIdParam =
      searchParams.get("stageId") || searchParams.get("stage_id");

    const stageId = stageIdParam ? Number(stageIdParam) : Number.NaN;

    if (!Number.isInteger(stageId) || stageId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid stage_id.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      DELETE FROM stages
      WHERE stage_id = ?
      `,
      [stageId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Stage not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedStageId: stageId,
    });
  } catch (error) {
    console.error("Failed to delete stage:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete stage.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}