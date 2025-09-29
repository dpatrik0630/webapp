from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import asyncpg

# JWT konfiguráció
SECRET_KEY = "nagyontitkoskulcs"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10

# Jelszó hashelés
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

auth_router = APIRouter()

db_pool = None

def set_db_pool(pool):
    global db_pool
    db_pool = pool

# Hash validáció
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# Token készítése
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Bejelentkezés endpoint
@auth_router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    print("Érkezett login próbálkozás:", form_data.username)

    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, username, password_hash, role FROM users WHERE username = $1", form_data.username)
        print("Lekérdezett user:", user)

        if not user or not verify_password(form_data.password, user["password_hash"]):
            print("Sikertelen jelszóellenőrzés.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

        token_data = {"sub": str(user["id"]), "role": user["role"]}
        access_token = create_access_token(data=token_data)
        print("Sikeres login, token generálva.")

        return {"access_token": access_token, "token_type": "bearer"}

# Token dekódolása & user azonosítás
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        role = payload.get("role")
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"id": user_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
