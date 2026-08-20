import json
import re

from app.core.config import settings
from app.models.trajectory import TrajectoryParams
from app.services.trajectory.engine import TrajectoryEngine, TrajectoryRequest, build_request_from_context


def _parse_nl_to_params(message: str, context: dict) -> TrajectoryParams:
    """Rule-based NL parser placeholder; OpenAI used when key is set."""
    params = TrajectoryParams()
    msg = message.lower()

    kop = re.search(r"(?:kop|kick.?off).{0,20}?(\d+(?:\.\d+)?)", msg)
    if kop:
        params.kop = float(kop.group(1))

    build = re.search(r"build.{0,20}?(\d+(?:\.\d+)?)", msg)
    if build:
        params.build_rate = float(build.group(1))

    turn = re.search(r"turn.{0,20}?(\d+(?:\.\d+)?)", msg)
    if turn:
        params.turn_rate = float(turn.group(1))

    dls = re.search(r"(?:dls|dogleg).{0,20}?(\d+(?:\.\d+)?)", msg)
    if dls:
        params.max_dls = float(dls.group(1))

    tvd = re.search(r"tvd.{0,20}?(\d+(?:\.\d+)?)", msg)
    if tvd and context.get("targets"):
        context["targets"][0]["tvdss"] = float(tvd.group(1))

    return params


async def ai_chat_response(
    message: str,
    well,
    subsurface,
    history: list[dict],
) -> dict:
    """Process NL instruction and propose trajectory."""
    context = {
        "well": well.model_dump() if well else {},
        "targets": [t.model_dump() for t in subsurface.targets] if subsurface else [],
        "formations": [f.model_dump() for f in subsurface.formations] if subsurface else [],
    }

    if settings.openai_api_key:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            system = (
                "You are a well trajectory planning assistant. "
                "Extract trajectory parameters from user instructions. "
                "Return JSON with keys: kop, build_rate, turn_rate, max_dls, explanation. "
                f"Well context: {json.dumps(context)}"
            )
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": system}, *history, {"role": "user", "content": message}],
                response_format={"type": "json_object"},
            )
            parsed = json.loads(resp.choices[0].message.content or "{}")
            params = TrajectoryParams(
                kop=parsed.get("kop"),
                build_rate=parsed.get("build_rate"),
                turn_rate=parsed.get("turn_rate"),
                max_dls=parsed.get("max_dls"),
            )
            explanation = parsed.get("explanation", "Proposed trajectory from AI.")
        except Exception as exc:
            params = _parse_nl_to_params(message, context)
            explanation = f"Used fallback parser ({exc}). Adjust parameters as needed."
    else:
        params = _parse_nl_to_params(message, context)
        explanation = (
            "Parsed your instruction into trajectory parameters. "
            "Set OPENAI_API_KEY for richer natural language understanding."
        )

    req = build_request_from_context(well, subsurface, params)
    engine = TrajectoryEngine()
    result = engine.generate(req)

    return {
        "reply": explanation,
        "params": params.model_dump(),
        "stations": [s.model_dump() for s in result.stations],
        "summary": result.summary,
        "validation_errors": result.validation_errors,
        "info_messages": result.info_messages,
    }
