/**
 * Cloudflare Pages Function: /api/reservations
 * API لإدارة وحفظ الحجوزات سحابياً عبر Cloudflare KV
 */

export async function onRequestGet({ env }) {
  try {
    if (!env.RESERVATIONS_KV) {
      return new Response(JSON.stringify({ error: "KV not bound", reservations: [] }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const data = await env.RESERVATIONS_KV.get("all_reservations", { type: "json" });
    const reservations = data || [];

    return new Response(JSON.stringify({ success: true, reservations }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message, reservations: [] }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const booking = await request.json();

    if (!booking.name || !booking.phone) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let reservations = [];
    if (env.RESERVATIONS_KV) {
      const existing = await env.RESERVATIONS_KV.get("all_reservations", { type: "json" });
      reservations = existing || [];
    }

    // Add new reservation at the beginning
    reservations.unshift(booking);

    // Keep up to 500 recent bookings
    if (reservations.length > 500) reservations = reservations.slice(0, 500);

    if (env.RESERVATIONS_KV) {
      await env.RESERVATIONS_KV.put("all_reservations", JSON.stringify(reservations));
    }

    return new Response(JSON.stringify({ success: true, reservation: booking, total: reservations.length }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const { id, status } = await request.json();
    if (!id || !status || !env.RESERVATIONS_KV) {
      return new Response(JSON.stringify({ success: false, error: "Missing id/status" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let reservations = (await env.RESERVATIONS_KV.get("all_reservations", { type: "json" })) || [];
    const item = reservations.find(r => r.id === id);
    if (item) {
      item.status = status;
      await env.RESERVATIONS_KV.put("all_reservations", JSON.stringify(reservations));
      return new Response(JSON.stringify({ success: true, updated: item }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Reservation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || !env.RESERVATIONS_KV) {
      return new Response(JSON.stringify({ success: false, error: "Missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let reservations = (await env.RESERVATIONS_KV.get("all_reservations", { type: "json" })) || [];
    reservations = reservations.filter(r => r.id !== id);
    await env.RESERVATIONS_KV.put("all_reservations", JSON.stringify(reservations));

    return new Response(JSON.stringify({ success: true, deleted: id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
