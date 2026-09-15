import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.database import Database

from app.db import get_database
from app.schemas.common import RoleName
from app.schemas.user import Token, User, UserCreate, UserInDB, UserLogin, UserRole, ProfileUpdate

from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

#here we create api routes for login , register users, and get the current user and imports files like access token for authentication , hash password and verify functions for verifications, 
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)

def register_user(payload: UserCreate, db: Database = Depends(get_database)):
    """Register a new user account."""
    users_col = db["users"]

    # Check for existing email
    if users_col.find_one({"email": payload.email.lower()}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    # Assign default role if none provided
    roles = payload.roles
    if not roles:
        default_role = (
            RoleName.FULL_TIME_STAFF
            if payload.user_type.value == "full-time"
            else RoleName.GUEST
        )
        roles = [
            UserRole(
                role_id=str(uuid.uuid4()),
                role_name=default_role,
            )
        ]

    user_id = str(uuid.uuid4())
    user_in_db = UserInDB(
        _id=user_id,
        email=payload.email.lower(),
        user_type=payload.user_type,
        team=payload.team,
        is_active=True,
        profile=payload.profile,
        roles=roles,
        hashed_password=hash_password(payload.password),
        created_at=datetime.now(timezone.utc),
    )

    users_col.insert_one(user_in_db.to_mongo())
    created_doc = users_col.find_one({"_id": user_id})
    return User(**created_doc)


@router.post(
    "/login",
    response_model=Token,
    summary="User login (supports JSON and Swagger Authorize form)",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "email": {"type": "string", "example": "johndoe@example.com"},
                            "password": {"type": "string", "example": "secret123"},
                        },
                        "required": ["password"],
                    }
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "username": {"type": "string", "description": "Email address"},
                            "password": {"type": "string"},
                        },
                        "required": ["username", "password"],
                    }
                },
            }
        }
    },
)
async def login(request: Request, db: Database = Depends(get_database)):
    """Authenticate user with email/username and password via JSON or Form Data."""
    content_type = request.headers.get("content-type", "")

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type: #extracting forms the data from swagger/ html forms
        form = await request.form()
        identifier = form.get("username") or form.get("email")
        password = form.get("password")
    else:
        try: #extracts data from frontend apps/ POSTMAN
            body = await request.json()
            identifier = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid request body. Expected JSON or Form data.",
            )
    #condition for checking user exists
    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both email and password are required.",
        )

    users_col = db["users"]
    user_doc = users_col.find_one({"email": str(identifier).strip().lower()})

    #check if user exists and password is correct
    if not user_doc or not verify_password(str(password), user_doc.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    #condition for checking if the user account is active 
    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    #creating access token by encoding the user id and email with secret key
    access_token = create_access_token(
        data={"sub": user_doc["_id"], "email": user_doc["email"]}
    )
    #returning the access token
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=User)
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile of currently authenticated user."""
    return current_user


@router.patch("/me", response_model=User)
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Update the current user's profile. Only fields included in the request are changed."""
    users_col = db["users"]

    # Build the update dict — only include fields that were actually provided
    update_fields: dict = {}

    if payload.first_name is not None:
        update_fields["profile.first_name"] = payload.first_name
    if payload.last_name is not None:
        update_fields["profile.last_name"] = payload.last_name
    if payload.phone is not None:
        update_fields["profile.phone"] = payload.phone
    if payload.avatar_url is not None:
        update_fields["profile.avatar_url"] = payload.avatar_url
    if payload.team is not None:
        update_fields["team"] = payload.team.value

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    update_fields["updated_at"] = datetime.now(timezone.utc)

    users_col.update_one(
        {"_id": current_user.id},
        {"$set": update_fields},
    )

    updated_doc = users_col.find_one({"_id": current_user.id})
    return User(**updated_doc)
