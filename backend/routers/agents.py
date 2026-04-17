from fastapi import APIRouter, BackgroundTasks, Depends
from models.family import Family
from models.user import User
from dependencies import get_current_family
from services.agents.opportunity import run_opportunity_agent
from services.agents.travel import run_travel_agent

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/opportunities/run", status_code=204)
def trigger_opportunity_agent(
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    background_tasks.add_task(run_opportunity_agent, family.id)


@router.post("/travel/run", status_code=204)
def trigger_travel_agent(
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    background_tasks.add_task(run_travel_agent, family.id)
